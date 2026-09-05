# Dashboard editor: controls remain disabled after loading

## Confirmed cause

On main at `d34cf6363f6abbd9f6b297d98de4a799adf96eec`, opening the
content editor with a nonempty draft leaves Save draft, Preview, Publish,
Add section and the template selector disabled even after the draft loads.

1. `initLandingEditor()` calls `setBusy(true)` before requesting the draft.
2. The request succeeds and `renderSections()` runs while `busy` is still true.
3. Rendering calls `setBusy(true)` again. Existing controls overwrite their
   original enabled state with their temporary disabled state.
4. `setBusy(false)` restores that incorrect state, leaving those controls locked.

The initial section cards also retained disabled movement arrows and could not
be dragged: they were created while busy, and unlocking did not update dragging.

## Correction

Preserve each control's state from its first lock, including when rendering adds
new controls during an operation. Calculate movement boundaries independently
of the temporary lock. Update section dragging whenever the lock changes.

The existing protection against editing or saving after a failed initial draft
load remains in place. This change does not grant access or bypass API errors.

## Regression verification

`node --test tests/landing-editor-dom.test.js` exercises the actual editor and
content helpers in a DOM, replacing only the external landing API:

- Nonempty draft loads and unlocks actions; movement boundaries remain correct.
- Spanish and English edits reach the save payload; editing resumes after save.
- An empty draft can add and save its first section.
- A failed save unlocks the editor for retry.
- A failed initial load cannot save an empty replacement draft.

The first two tests failed on the original implementation because Save remained
disabled. All five pass with the fix. Dragging is checked after load, during save
and after completion. `linkedom` is a development dependency only.

## Backend and deployment scope

No Supabase changes, migrations, function updates, data writes or deployments
are required to reproduce or correct this frontend defect. No production session
or authenticated backend write was used during verification. Backend permissions
and the deployed schema were not audited; no missing backend prerequisite was
identified by this reproduction. A separate draft-load error would require its
actual response and authenticated role to diagnose before proposing a deployment.

## Local environment

The existing `dashboard-role-delete-realtime.test.js` source regex assumes LF
line endings and failed on this Windows CRLF checkout. Reading its target
`admin-manager-actions.js` with its original Git LF content resolved that failure
without a source change. CI uses Linux.

Local `check:deploy` and `test:assets` reached the asset build (54 public files)
but Wrangler's bundler could not read an ancestor directory under the Windows
sandbox (`Access is denied`). These checks must also be evaluated in PR CI;
neither command was replaced with a real deployment.
