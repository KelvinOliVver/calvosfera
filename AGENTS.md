<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Rules
- Voice calls use WebRTC mesh with signaling over Cloud realtime broadcast/presence (`src/hooks/useVoice.ts`); no media server, so best for small groups.
- Media bucket is private (public buckets blocked); uploads store long-lived signed URLs in profiles.
- Account creation goes only through the registerAccount server function (public signup disabled) so ban checks cannot be bypassed.
