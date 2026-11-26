# @deepseek-ai/dsh-rollback

In-place edit/resend of a historical human prompt, in the same Session.

This package is a profile bundle. Its `cordis.patch.yml` inserts the `rollback` service. Install that directory with `plugin_manager` `install_bundle`; the profile records it in `dsh.profile.bundles` and applies the bundle patch as its own layer.

## What it does

`ctx.rollback.editPrompt(agent, { targetSeq, content }, signal)` shadows the
conversation tail from the edited prompt onward and re-enqueues the edited
content as a new follow-up turn. No new Session is created and files are not
touched.

## Durable record

The commit is a single `user/message` shadow node carrying
`surfaceOp: { op: 'replace', startSeq, endSeq }`. Its content is a one-line
model-only marker (`Conversation restarted.`) so the replacement never projects
an empty wire message; its source is `{ kind: 'rollback', reset: { startSeq } }`.
The marker reaches the next model request but is not part of the append-origin
transcript, so the visible chat does not show it.

## Transcript reset projection

The plugin registers a session projection under key `rollback` whose wire value
is `{ resets: { startSeq: number; endSeq: number }[] }`. Each committed edit
appends one interval with `startSeq` equal to the edited prompt's raw-log seq and
`endSeq` equal to the commit node's own seq. Consumers hide transcript entries
whose seq falls in any interval; overlapping intervals are unioned by the
consumer.

## Failure classes

`RollbackError` carries one of `busy` (agent active, a running child, or owned jobs that could not stop), `target` (not a current human prompt), `content` (empty or whitespace-only), `unbalanced` (tool call crosses the cut), or `committed` (reset landed but the resend is still pending).

The edit requests cancellation of the Session's running jobs and waits for running or stopping jobs to settle before resetting history. Unowned and foreign-owned jobs are unaffected. `jobStopTimeoutMs` bounds this wait (default 10000 milliseconds). Cancellation, a failed stop, or expiry leaves the conversation history intact, although jobs already asked to stop remain stopped or stopping. A committed reset discards pending inbox input before enqueuing the revised prompt, including old completion notices.

## Known Limitations

- The reset is a model-surface shadow, not a raw-log deletion; replay and
  forensics still see the shadowed tail.
- Child activity checks and job cancellation use the optional `subagents` and `jobs` services when mounted; work owned by an unmounted backend cannot be checked or stopped.
