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

async function attachScreenTrack(sender: RTCRtpSender, track: MediaStreamTrack) {
  await sender.replaceTrack(track);
  try {
    const parameters = sender.getParameters();
    if (parameters.encodings.length === 0) return;
    parameters.encodings[0].maxBitrate = 3_000_000;
    parameters.encodings[0].maxFramerate = 30;
    await sender.setParameters(parameters);
  } catch (err) {
    // Some browser engines don't allow sender tuning before negotiation. The
    // track is already attached, so keep sharing with the browser defaults.
    console.debug("screen sender tuning skipped", err);
  }
}

export function useVoice(me: string) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [peers, setPeers] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remoteScreens, setRemoteScreens] = useState<Record<string, MediaStream>>({});
  const [connectionStates, setConnectionStates] = useState<Record<string, RTCPeerConnectionState>>({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const blockedAudioPeersRef = useRef(new Set<string>());
  const callAttemptRef = useRef(0);
  const joiningRef = useRef(false);
  const pickingScreenRef = useRef(false);

  async function join(id: string) {
    if (channelId === id || joiningRef.current) return;
    leave();
    joiningRef.current = true;
    const attempt = callAttemptRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (attempt !== callAttemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setError(null);
      setMuted(false);
      setChannelId(id);
    } catch {
      if (attempt === callAttemptRef.current) setError("Permita o acesso ao microfone para entrar na call");
    } finally {
      if (attempt === callAttemptRef.current) joiningRef.current = false;
    }
  }

  function leave() {
    callAttemptRef.current += 1;
    joiningRef.current = false;
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    screenSendersRef.current.clear();
    setSharingScreen(false);
    setRemoteScreens({});
    setConnectionStates({});
    setAudioBlocked(false);
    blockedAudioPeersRef.current.clear();
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
    if (pickingScreenRef.current) return;
    pickingScreenRef.current = true;
    const attempt = callAttemptRef.current;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track || attempt !== callAttemptRef.current || !streamRef.current || !channelId) {
        stream.getTracks().forEach((item) => item.stop());
        return;
      }
      track.contentHint = "detail";
      screenRef.current = stream;
      track.onended = () => {
        if (screenRef.current !== stream) return;
        screenRef.current = null;
        void Promise.all([...screenSendersRef.current.values()].map((sender) => sender.replaceTrack(null).catch(() => {})));
        setSharingScreen(false);
      };
      const results = await Promise.allSettled([...screenSendersRef.current.values()].map((sender) => attachScreenTrack(sender, track)));
      if (results.some((result) => result.status === "rejected")) {
        setError("A tela foi selecionada, mas não foi possível enviá-la para todas as pessoas. Tente compartilhar novamente.");
      }
      setSharingScreen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      setError("Não foi possível compartilhar a tela");
    } finally {
      pickingScreenRef.current = false;
    }
  }

  function toggleMute() {
    const s = streamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  async function enableRemoteAudio() {
    await Promise.all([...remoteAudiosRef.current.entries()].map(async ([peer, audio]) => {
      try {
        await audio.play();
        blockedAudioPeersRef.current.delete(peer);
      } catch {
        blockedAudioPeersRef.current.add(peer);
      }
    }));
    setAudioBlocked(blockedAudioPeersRef.current.size > 0);
  }

  useEffect(() => {
    const stream = streamRef.current;
    if (!channelId || !stream) return;
    const pcs = new Map<string, RTCPeerConnection>();
    const pending = new Map<string, RTCIceCandidateInit[]>();
    const audios = remoteAudiosRef.current;
    const restartTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const restartAttempts = new Map<string, number>();

    const ch = supabase.channel(`voice-${channelId}`, {
      config: { presence: { key: me }, broadcast: { self: false } },
    });
    const send = async (p: Omit<Signal, "from">) => {
      try {
        const status = await ch.send({ type: "broadcast", event: "signal", payload: { ...p, from: me } });
        if (status !== "ok") setError("A conexão de sinalização caiu. Tentando reconectar…");
        return status;
      } catch (err) {
        console.warn("voice signal send error", err);
        setError("A conexão de sinalização caiu. Verifique sua conexão.");
        return "error" as const;
      }
    };

    const getPc = (peer: string) => {
      const existing = pcs.get(peer);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE });
      setConnectionStates((current) => ({ ...current, [peer]: pc.connectionState }));
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const screenSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
      screenSendersRef.current.set(peer, screenSender);
      if (screenRef.current?.getVideoTracks()[0]) {
        void attachScreenTrack(screenSender, screenRef.current.getVideoTracks()[0]).catch((err) => console.warn("screen track attach error", err));
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ to: peer, kind: "ice", candidate: e.candidate.toJSON() });
      };
      const scheduleIceRestart = () => {
        if (me > peer || restartTimers.has(peer)) return;
        const timer = setTimeout(() => {
          restartTimers.delete(peer);
          if (pc.connectionState === "closed" || pc.signalingState !== "stable") return;
          const attempts = restartAttempts.get(peer) ?? 0;
          if (attempts >= 4) {
            setError("A conexão de voz caiu. Saia e entre novamente no canal.");
            return;
          }
          restartAttempts.set(peer, attempts + 1);
          void pc.createOffer({ iceRestart: true }).then(async (offer) => {
            if (pc.connectionState === "closed") return;
            await pc.setLocalDescription(offer);
            await send({ to: peer, kind: "offer", sdp: pc.localDescription ?? offer });
          }).catch((err) => console.error("voice ICE restart error", err));
        }, 1500);
        restartTimers.set(peer, timer);
      };
      pc.onconnectionstatechange = () => {
        setConnectionStates((current) => ({ ...current, [peer]: pc.connectionState }));
        if (pc.connectionState === "connected") {
          const timer = restartTimers.get(peer);
          if (timer) clearTimeout(timer);
          restartTimers.delete(peer);
          restartAttempts.delete(peer);
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          scheduleIceRestart();
        }
      };
      pc.ontrack = (e) => {
        if (e.track.kind === "video") {
          const remote = e.streams[0] ?? new MediaStream([e.track]);
          const showRemote = () => {
            if (e.track.readyState === "live" && !e.track.muted) {
              setRemoteScreens((current) => ({ ...current, [peer]: remote }));
            }
          };
          const hideRemote = () => {
            // replaceTrack(null) mutes the remote track instead of ending it.
            // Wait briefly to avoid flicker during short network interruptions.
            setTimeout(() => {
              if (!e.track.muted || e.track.readyState === "ended") return;
              setRemoteScreens((current) => { const next = { ...current }; delete next[peer]; return next; });
            }, 1200);
          };
          const endRemote = () => {
            setRemoteScreens((current) => { const next = { ...current }; delete next[peer]; return next; });
          };
          e.track.addEventListener("unmute", showRemote);
          e.track.addEventListener("mute", hideRemote);
          e.track.addEventListener("ended", endRemote);
          // A track may already be receiving by the time ontrack runs.
          showRemote();
          return;
        }
        let a = audios.get(peer);
        if (!a) {
          a = new Audio();
          a.autoplay = true;
          audios.set(peer, a);
        }
        a.srcObject = e.streams[0] ?? null;
        a.play().then(() => {
          blockedAudioPeersRef.current.delete(peer);
          setAudioBlocked(blockedAudioPeersRef.current.size > 0);
        }).catch(() => {
          blockedAudioPeersRef.current.add(peer);
          setAudioBlocked(true);
        });
      };
      pcs.set(peer, pc);
      return pc;
    };

    const closePeer = (peer: string) => {
      const pc = pcs.get(peer);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      pcs.delete(peer);
      const restartTimer = restartTimers.get(peer);
      if (restartTimer) clearTimeout(restartTimer);
      restartTimers.delete(peer);
      restartAttempts.delete(peer);
      const a = audios.get(peer);
      if (a) {
        a.srcObject = null;
        audios.delete(peer);
      }
      blockedAudioPeersRef.current.delete(peer);
      setAudioBlocked(blockedAudioPeersRef.current.size > 0);
      screenSendersRef.current.delete(peer);
      setRemoteScreens((current) => { const next = { ...current }; delete next[peer]; return next; });
      setConnectionStates((current) => { const next = { ...current }; delete next[peer]; return next; });
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
          send({ to: id, kind: "offer", sdp: pc.localDescription ?? offer });
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
            send({ to: s.from, kind: "answer", sdp: pc.localDescription ?? ans });
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
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Não foi possível manter a sinalização da chamada. Verifique sua conexão.");
        }
      });

    return () => {
      for (const id of [...pcs.keys()]) closePeer(id);
      restartTimers.forEach((timer) => clearTimeout(timer));
      supabase.removeChannel(ch);
    };
  }, [channelId, me]);

  useEffect(() => () => {
    callAttemptRef.current += 1;
    screenRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenRef.current = null;
    streamRef.current = null;
  }, []);

  return { channelId, peers, muted, sharingScreen, remoteScreens, connectionStates, audioBlocked, error, join, leave, toggleMute, toggleScreenShare, enableRemoteAudio };
}
