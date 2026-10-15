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
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setChannelId(null);
    setPeers([]);
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
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ to: peer, kind: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        let a = audios.get(peer);
        if (!a) {
          a = new Audio();
          a.autoplay = true;
          audios.set(peer, a);
        }
        a.srcObject = e.streams[0];
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

  return { channelId, peers, muted, error, join, leave, toggleMute };
}
