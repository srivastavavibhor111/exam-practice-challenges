import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import * as folderService from '../../services/folderService';
import { isExactDeletePhrase, DELETE_CONFIRM_PHRASE, pluralize, toRef } from './folderUtils';

/* ─── FolderDialogs — NEW ─────────────────────────────────────────────────────
   Every dialog used by the Custom Test Folders feature, in one file:

     ModalShell          the shared frame (backdrop, focus trap, Escape, scroll lock)
     FolderNameDialog    create a folder / rename a folder
     ChooseFolderDialog  pick ONE folder — used for "Add to folder" and "Move"
     AddTestsDialog      pick MANY tests to put into the open folder
     DeleteFolderDialog  the strict two-option, type-DELETE workflow

   Styling lives in MyTestsFolders.css under the mtf-modal-* prefix. The look
   mirrors the Profile page's delete-account dialog (as requested) but uses its
   own class names — Dashboard.css and Profile.css both define a global
   .dmodal-card with DIFFERENT rules, so adding a third copy under that name
   could silently change those two modals.

   Contract shared by the dialogs that save something: `onSubmit` returns a
   promise. If it rejects, the dialog shows err.message and stays open; if it
   resolves, the PARENT closes the dialog. A dialog never closes itself on
   success, so it can never claim success while the request actually failed.
────────────────────────────────────────────────────────────────────────────── */

export const FOLDER_NAME_MAX_LENGTH = 50;
const MAX_ITEMS_PER_REQUEST = 100;

/* ─── ModalShell ──────────────────────────────────────────────────────────── */

function ModalShell({ titleId, title, onClose, busy = false, size = 'md', children }) {
  // Pass `null` so the hook does not manage Escape itself: its effect re-runs
  // whenever onClose changes identity, which would re-steal focus on every
  // render. Escape is handled below with a ref to the latest callback instead.
  const trapRef = useFocusTrap(true, null);

  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) {
      if (e.key === 'Escape' && !latest.current.busy) latest.current.onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      className="mtf-modal-backdrop"
      // mousedown (not click) so dragging a text selection out of an input and
      // releasing over the backdrop does not close the dialog by accident.
      onMouseDown={e => {
        if (e.target === e.currentTarget && !latest.current.busy) latest.current.onClose();
      }}
    >
      <div
        ref={trapRef}
        className={`mtf-modal-card mtf-modal-card--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 className="mtf-modal-title" id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function DialogError({ children }) {
  if (!children) return null;
  return (
    <p className="mtf-modal-error" role="alert">
      <ErrorIcon /> <span>{children}</span>
    </p>
  );
}

/* ─── FolderNameDialog (create / rename) ──────────────────────────────────── */

export function FolderNameDialog({ mode, initialName = '', onSubmit, onClose }) {
  const titleId = useId();
  const hintId = useId();
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isCreate = mode === 'create';

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a folder name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(trimmed); // parent closes the dialog on success
    } catch (err) {
      setError(err.message || 'Could not save this folder. Please try again.');
      setSaving(false);
    }
  }

  return (
    <ModalShell titleId={titleId} title={isCreate ? 'Create folder' : 'Rename folder'} onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit} noValidate>
        <label className="mtf-field-label" htmlFor={inputId}>Folder name</label>
        <input
          id={inputId}
          type="text"
          className="mtf-input"
          value={name}
          onChange={e => { setName(e.target.value); if (error) setError(''); }}
          maxLength={FOLDER_NAME_MAX_LENGTH}
          autoComplete="off"
          aria-describedby={hintId}
          aria-invalid={error ? 'true' : undefined}
          placeholder="e.g. Python Revision"
        />
        <p className="mtf-hint" id={hintId}>
          Up to {FOLDER_NAME_MAX_LENGTH} characters. Capital letters matter: “Python” and “python” are different folders.
        </p>
        <DialogError>{error}</DialogError>

        <div className="mtf-modal-actions">
          <button type="button" className="btn mtf-quiet" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isCreate ? 'Create Folder' : 'Save Name'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ─── ChooseFolderDialog (pick one folder: "Add to folder" and "Move") ────── */

export function ChooseFolderDialog({ title, intro, folders, confirmLabel, emptyMessage, onSubmit, onClose }) {
  const titleId = useId();
  const [chosenId, setChosenId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!chosenId || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit(chosenId);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <ModalShell titleId={titleId} title={title} onClose={onClose} busy={saving}>
      {intro && <p className="mtf-modal-body">{intro}</p>}

      {folders.length === 0 ? (
        <p className="mtf-modal-body">{emptyMessage}</p>
      ) : (
        <fieldset className="mtf-fieldset">
          <legend className="mtf-sr-only">Choose a folder</legend>
          <ul className="mtf-pick-list">
            {folders.map(f => (
              <li key={f.id}>
                <label className="mtf-pick-row">
                  <input
                    type="radio"
                    name="mtf-choose-folder"
                    value={f.id}
                    checked={chosenId === f.id}
                    onChange={() => setChosenId(f.id)}
                  />
                  <span className="mtf-pick-row__text">
                    <span className="mtf-pick-row__title">{f.name}</span>
                    <span className="mtf-pick-row__meta">{pluralize(f.itemCount, 'test')}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <DialogError>{error}</DialogError>

      <div className="mtf-modal-actions">
        <button type="button" className="btn mtf-quiet" onClick={onClose} disabled={saving}>
          {folders.length === 0 ? 'Close' : 'Cancel'}
        </button>
        {folders.length > 0 && (
          <button type="button" className="btn btn--primary" onClick={handleConfirm} disabled={!chosenId || saving}>
            {saving ? 'Working…' : confirmLabel}
          </button>
        )}
      </div>
    </ModalShell>
  );
}

/* ─── AddTestsDialog (pick many tests for the open folder) ────────────────── */

export function AddTestsDialog({ folderName, candidates, onSubmit, onClose }) {
  const titleId = useId();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? candidates.filter(c => c.title.toLowerCase().includes(q)) : candidates;
  }, [candidates, query]);

  function toggle(key) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAllShown() {
    setSelected(prev => new Set([...prev, ...shown.map(c => c.key)]));
  }

  const count = selected.size;
  const tooMany = count > MAX_ITEMS_PER_REQUEST;

  async function handleConfirm() {
    if (count === 0 || tooMany || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit(candidates.filter(c => selected.has(c.key)).map(toRef));
    } catch (err) {
      setError(err.message || 'Could not add these tests. Please try again.');
      setSaving(false);
    }
  }

  return (
    <ModalShell titleId={titleId} title={`Add tests to “${folderName}”`} onClose={onClose} busy={saving} size="lg">
      {candidates.length === 0 ? (
        <>
          <p className="mtf-modal-body">
            There are no other tests to add. Only tests you have attempted and submitted can go into a folder,
            and every one of them is already in this folder.
          </p>
          <div className="mtf-modal-actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>Close</button>
          </div>
        </>
      ) : (
        <>
          <p className="mtf-modal-body">Choose the tests you want in this folder. Only attempted tests are listed.</p>

          <label className="mtf-field-label" htmlFor={searchId}>Search tests</label>
          <input
            id={searchId}
            type="text"
            className="mtf-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by title…"
            autoComplete="off"
          />

          <div className="mtf-pick-toolbar">
            <span aria-live="polite">{pluralize(count, 'test')} selected</span>
            <span className="mtf-pick-toolbar__buttons">
              <button type="button" className="mtf-link-btn" onClick={selectAllShown} disabled={shown.length === 0}>
                Select all shown
              </button>
              <button type="button" className="mtf-link-btn" onClick={() => setSelected(new Set())} disabled={count === 0}>
                Clear
              </button>
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="mtf-modal-body">No tests match “{query}”.</p>
          ) : (
            <ul className="mtf-pick-list mtf-pick-list--scroll">
              {shown.map(c => (
                <li key={c.key}>
                  <label className="mtf-pick-row">
                    <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} />
                    <span className="mtf-pick-row__text">
                      <span className="mtf-pick-row__title">{c.title}</span>
                      <span className="mtf-pick-row__meta">
                        {pluralize(c.questionCount, 'question')}
                        {c.itemType === 'sharedTest' ? ' · Shared test' : ''}
                        {c.isPracticeSet ? ' · Practice set' : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {tooMany && (
            <p className="mtf-hint">You can add at most {MAX_ITEMS_PER_REQUEST} tests at a time. Deselect a few.</p>
          )}
          <DialogError>{error}</DialogError>

          <div className="mtf-modal-actions">
            <button type="button" className="btn mtf-quiet" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn--primary" onClick={handleConfirm} disabled={count === 0 || tooMany || saving}>
              {saving ? 'Adding…' : count === 0 ? 'Add Tests' : `Add ${pluralize(count, 'test')}`}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

/* ─── DeleteFolderDialog (strict two-option, typed-DELETE workflow) ───────────
   Flow:  open → fetch a read-only preview of what each option would do →
          user picks an option → user types DELETE exactly → button enables.

   Nothing is deleted until the final button is pressed. Cancel, Escape and a
   backdrop click all close the dialog without any request being made.

   The typed text is compared with === and is NEVER trimmed or case-folded
   (see isExactDeletePhrase). The server separately re-checks authentication,
   folder ownership, the chosen mode and which tests the user may delete —
   this dialog is a safety net for the human, not the security boundary.
────────────────────────────────────────────────────────────────────────────── */

export function DeleteFolderDialog({ folder, onConfirm, onClose }) {
  const titleId = useId();
  const confirmInputId = useId();
  const hintId = useId();

  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [previewError, setPreviewError] = useState('');
  const [mode, setMode] = useState(null); // null | 'folder_only' | 'folder_and_tests'
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    folderService.getDeletionPreview(folder.id)
      .then(p => {
        if (cancelled) return;
        setPreview(p);
        setPreviewStatus('ready');
      })
      .catch(err => {
        if (cancelled) return;
        setPreviewError(err.message || 'Could not check what this folder contains.');
        setPreviewStatus('error');
      });
    return () => { cancelled = true; };
  }, [folder.id]);

  const phraseOk = isExactDeletePhrase(confirmText);
  const canDelete = previewStatus === 'ready' && mode !== null && phraseOk && !deleting;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onConfirm(mode); // parent closes the dialog on success
    } catch (err) {
      setError(err.message || 'Could not delete this folder. Nothing was changed. Please try again.');
      setDeleting(false);
    }
  }

  const deletable = preview ? preview.deletableTests : [];
  const canDeleteTests = deletable.length > 0;

  let hint;
  if (previewStatus !== 'ready') hint = 'Waiting for the folder details…';
  else if (mode === null) hint = 'Choose one of the options above to continue.';
  else if (!phraseOk) hint = `Type ${DELETE_CONFIRM_PHRASE} exactly — all capitals, no spaces — to enable the delete button.`;
  else hint = 'Confirmed. The delete button is now enabled.';

  return (
    <ModalShell titleId={titleId} title={`Delete folder “${folder.name}”?`} onClose={onClose} busy={deleting} size="lg">
      <div className="mtf-modal-scroll">
        {previewStatus === 'loading' && (
          <p className="mtf-modal-body" role="status">Checking what is in this folder…</p>
        )}

        {previewStatus === 'error' && <DialogError>{previewError}</DialogError>}

        {previewStatus === 'ready' && (
          <>
            <p className="mtf-modal-body">
              This folder contains <strong>{pluralize(preview.totalItems, 'test')}</strong>.
              Choose what should happen to them. Deleting a folder is not the same as deleting its tests.
            </p>

            <fieldset className="mtf-fieldset" disabled={deleting}>
              <legend className="mtf-sr-only">Deletion option</legend>

              <label className={`mtf-option${mode === 'folder_only' ? ' mtf-option--selected' : ''}`}>
                <input
                  type="radio"
                  name="mtf-delete-mode"
                  value="folder_only"
                  checked={mode === 'folder_only'}
                  onChange={() => setMode('folder_only')}
                  className="mtf-select-radio"
                />
                <span className="mtf-option__text">
                  <span className="mtf-option__title">Delete only this folder</span>
                  <span className="mtf-option__desc">
                    Safe option. Your tests, questions, attempts and scores are all kept. Any test that is not in
                    another folder goes back to Unorganized.
                  </span>
                </span>
              </label>

              <label className={`mtf-option mtf-option--danger${mode === 'folder_and_tests' ? ' mtf-option--selected' : ''}${canDeleteTests ? '' : ' mtf-option--disabled'}`}>
                <input
                  type="radio"
                  name="mtf-delete-mode"
                  value="folder_and_tests"
                  checked={mode === 'folder_and_tests'}
                  onChange={() => setMode('folder_and_tests')}
                  disabled={!canDeleteTests}
                  className="mtf-select-radio"
                />
                <span className="mtf-option__text">
                  <span className="mtf-option__title">Delete this folder and its tests</span>
                  {canDeleteTests ? (
                    <span className="mtf-option__desc">
                      <strong>Permanently deletes {deletable.length} of your {deletable.length === 1 ? 'test' : 'tests'}</strong>
                      {' '}({summarizeTitles(deletable)}) together with their questions and{' '}
                      {pluralize(preview.attemptsAffected, 'attempt record')}, including your scores and results for them.
                      This cannot be undone.
                      {preview.alsoInOtherFolders > 0 && (
                        <> {pluralize(preview.alsoInOtherFolders, 'of these tests is', 'of these tests are')} also in other
                        folders and will disappear from them too.</>
                      )}
                      {preview.sharedCount > 0 && (
                        <> {pluralize(preview.sharedCount, 'shared test')} will only be removed from this folder — shared
                        tests are never deleted.</>
                      )}
                    </span>
                  ) : (
                    <span className="mtf-option__desc">
                      Not available: there are no tests in this folder that you are allowed to delete.
                      {preview.sharedCount > 0 && ' Shared tests are never deleted, only removed from the folder.'}
                    </span>
                  )}
                </span>
              </label>
            </fieldset>

            <label className="mtf-field-label" htmlFor={confirmInputId}>
              Type <strong>{DELETE_CONFIRM_PHRASE}</strong> to confirm.
            </label>
            <input
              id={confirmInputId}
              type="text"
              className="mtf-input"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby={hintId}
              disabled={deleting}
            />
            <p className="mtf-hint" id={hintId}>{hint}</p>
          </>
        )}

        <DialogError>{error}</DialogError>
      </div>

      <div className="mtf-modal-actions mtf-modal-actions--bordered">
        <button type="button" className="btn mtf-quiet" onClick={onClose} disabled={deleting}>Cancel</button>
        <button
          type="button"
          className="mtf-modal-btn mtf-modal-btn--danger"
          onClick={handleDelete}
          disabled={!canDelete}
          aria-describedby={hintId}
        >
          {deleting ? 'Deleting…' : mode === 'folder_and_tests' ? 'Delete Folder and Tests' : 'Delete Folder'}
        </button>
      </div>
    </ModalShell>
  );
}

function summarizeTitles(tests) {
  const shown = tests.slice(0, 3).map(t => `“${t.title}”`);
  const rest = tests.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
