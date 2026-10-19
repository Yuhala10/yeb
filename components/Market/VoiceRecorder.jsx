import { useEffect, useRef, useState } from "react";

import VoiceNote from "./VoiceNote";
import { useSocialText } from "../../lib/socialText";

/*
 * Records a voice caption (up to 60 seconds) with the phone's
 * microphone, in whatever format the phone makes (WebM on
 * Android, MP4 on iPhone), at a low bitrate so it sends fast
 * on mobile data.
 *
 * value:    { dataUrl, seconds } (new), { url, seconds } (saved) or null
 * onChange: (value | null)
 */

const MAX_SECONDS = 60;

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export default function VoiceRecorder({ value, onChange, disabled = false }) {
    const s = useSocialText();

    const [recording, setRecording] = useState(false);

    const [seconds, setSeconds] = useState(0);

    const [error, setError] = useState("");

    const parts = useRef({ recorder: null, stream: null, timer: null, started: 0, chunks: [] });

    useEffect(() => {
        const current = parts.current;

        return () => {
            clearInterval(current.timer);
            current.stream?.getTracks().forEach((track) => track.stop());
        };
    }, []);

    async function start() {
        setError("");

        if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
            setError(s("micMissing"));
            return;
        }

        let stream;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (failure) {
            setError(failure?.name === "NotAllowedError" ? s("micBlocked") : s("micMissing"));
            return;
        }

        const mimeType = TYPES.find((type) => window.MediaRecorder.isTypeSupported?.(type)) || "";

        const recorder = new window.MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });

        const current = parts.current;

        current.recorder = recorder;
        current.stream = stream;
        current.chunks = [];
        current.started = Date.now();

        recorder.addEventListener("dataavailable", (event) => {
            if (event.data && event.data.size) {
                current.chunks.push(event.data);
            }
        });

        recorder.addEventListener("stop", () => {
            clearInterval(current.timer);
            stream.getTracks().forEach((track) => track.stop());

            const length = Math.max(1, Math.round((Date.now() - current.started) / 1000));

            const blob = new Blob(current.chunks, { type: recorder.mimeType || mimeType || "audio/webm" });

            const reader = new FileReader();

            reader.onload = () => onChange({ dataUrl: String(reader.result), seconds: Math.min(length, MAX_SECONDS) });

            reader.readAsDataURL(blob);

            setRecording(false);
        });

        recorder.start(1000);

        setSeconds(0);
        setRecording(true);

        current.timer = setInterval(() => {
            const elapsed = Math.round((Date.now() - current.started) / 1000);

            setSeconds(elapsed);

            if (elapsed >= MAX_SECONDS && recorder.state === "recording") {
                recorder.stop();
            }
        }, 250);
    }

    function stop() {
        const recorder = parts.current.recorder;

        if (recorder && recorder.state === "recording") {
            recorder.stop();
        }
    }

    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

    if (recording) {
        return (
            <div className="sm-recorder is-recording">
                <span className="sm-rec-dot" aria-hidden="true" />
                <strong>{s("recording", { s: clock })}</strong>
                <button type="button" className="ts-btn ts-btn-ink ts-btn-sm" onClick={stop}>
                    ■ {s("stop")}
                </button>
            </div>
        );
    }

    if (value && (value.dataUrl || value.url)) {
        return (
            <div className="sm-recorder">
                <VoiceNote url={value.dataUrl || value.url} seconds={value.seconds} />
                <div className="sm-recorder-actions">
                    <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={start} disabled={disabled}>
                        🎙️ {s("redo")}
                    </button>
                    <button type="button" className="ts-btn ts-btn-light ts-btn-sm" onClick={() => onChange(null)} disabled={disabled}>
                        ✕ {s("remove")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="sm-recorder">
            <button type="button" className="sm-record-btn" onClick={start} disabled={disabled}>
                <span aria-hidden="true">🎙️</span>
                <span>
                    <strong>{s("record")}</strong>
                    <small>{s("recordHint")}</small>
                </span>
            </button>
            {error && <p className="sm-error" role="alert">{error}</p>}
        </div>
    );
}
