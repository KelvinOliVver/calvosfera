import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Signal = {
  from: string;
  to: string;
  kind: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

export function useVoice(me: string) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remoteScreens, setRemoteScreens] = useState<Record<string, MediaStream>>({});
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  async function join(id: string) {
    if (channelId === id) return;
    leave();
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setError(null);
      setMuted(false);
      setChannelId(id);
    } catch {
      setError("Permita o acesso ao microfone para entrar na call");
    }
  }

  function leave() {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    screenSendersRef.current.clear();
    setSharingScreen(false);
    setRemoteScreens({});
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setChannelId(null);
    setPeers([]);
  }

  async function toggleScreenShare() {
    if (screenRef.current) {
      const stream = screenRef.current;
      screenRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      await Promise.all([...screenSendersRef.current.values()].map((sender) => sender.replaceTrack(null).catch(() => {})));
      setSharingScreen(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      screenRef.current = stream;
      await Promise.all([...screenSendersRef.current.values()].map((sender) => sender.replaceTrack(track)));
      track.onended = () => {
        if (screenRef.current !== stream) return;
        screenRef.current = null;
        void Promise.all([...screenSendersRef.current.values()].map((sender) => sender.replaceTrack(null).catch(() => {})));
        setSharingScreen(false);
      };
      setSharingScreen(true);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      setError("Não foi possível compartilhar a tela");
    }
  }

  function toggleMute() {
    const s = streamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  useEffect(() => {
    const stream = streamRef.current;
    if (!channelId || !stream) return;
    const pcs = new Map<string, RTCPeerConnection>();
    const pending = new Map<string, RTCIceCandidateInit[]>();
    const audios = new Map<string, HTMLAudioElement>();
    const videos = new Map<string, MediaStream>();

    const ch = supabase.channel(`voice-${channelId}`, {
      config: { presence: { key: me }, broadcast: { self: false } },
    });
    const send = (p: Omit<Signal, "from">) =>
      ch.send({ type: "broadcast", event: "signal", payload: { ...p, from: me } });

    const getPc = (peer: string) => {
      const existing = pcs.get(peer);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const screenSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
      screenSendersRef.current.set(peer, screenSender);
      if (screenRef.current?.getVideoTracks()[0]) void screenSender.replaceTrack(screenRef.current.getVideoTracks()[0]);
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ to: peer, kind: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        if (e.track.kind === "video") {
          const remote = e.streams[0] ?? new MediaStream([e.track]);
          videos.set(peer, remote);
          // onunmute can fire before ontrack handlers are attached. Publish the
          // stream immediately so the video element is mounted in either case.
          setRemoteScreens((current) => ({ ...current, [peer]: remote }));
          e.track.onended = () => {
            videos.delete(peer);
            setRemoteScreens((current) => { const next = { ...current }; delete next[peer]; return next; });
          };
          return;
        }
        let a = audios.get(peer);
        if (!a) {
          a = new Audio();
          a.autoplay = true;
          audios.set(peer, a);
        }
        a.srcObject = e.streams[0] ?? null;
        a.play().catch(() => {});
      };
      pcs.set(peer, pc);
      return pc;
    };

    const closePeer = (peer: string) => {
      pcs.get(peer)?.close();
      pcs.delete(peer);
      const a = audios.get(peer);
      if (a) {
        a.srcObject = null;
        audios.delete(peer);
      }
      videos.delete(peer);
      screenSendersRef.current.delete(peer);
      setRemoteScreens((current) => { const next = { ...current }; delete next[peer]; return next; });
    };

    const flush = async (peer: string, pc: RTCPeerConnection) => {
      for (const c of pending.get(peer) ?? []) await pc.addIceCandidate(c).catch(() => {});
      pending.delete(peer);
    };

    ch.on("presence", { event: "sync" }, async () => {
      const ids = Object.keys(ch.presenceState()).filter((i) => i !== me);
      setPeers(ids);
      for (const id of [...pcs.keys()]) if (!ids.includes(id)) closePeer(id);
      for (const id of ids) {
        if (!pcs.has(id) && me < id) {
          const pc = getPc(id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ to: id, kind: "offer", sdp: offer });
        }
      }
    })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const s = payload as Signal;
        if (s.to !== me) return;
        const pc = getPc(s.from);
        try {
          if (s.kind === "offer" && s.sdp) {
            await pc.setRemoteDescription(s.sdp);
            await flush(s.from, pc);
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            send({ to: s.from, kind: "answer", sdp: ans });
          } else if (s.kind === "answer" && s.sdp) {
            await pc.setRemoteDescription(s.sdp);
            await flush(s.from, pc);
          } else if (s.kind === "ice" && s.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(s.candidate).catch(() => {});
            else pending.set(s.from, [...(pending.get(s.from) ?? []), s.candidate]);
          }
        } catch (err) {
          console.error("voice signal error", err);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ joined: Date.now() });
      });

    return () => {
      for (const id of [...pcs.keys()]) closePeer(id);
      supabase.removeChannel(ch);
    };
  }, [channelId, me]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { channelId, peers, muted, sharingScreen, remoteScreens, error, join, leave, toggleMute, toggleScreenShare };
}
