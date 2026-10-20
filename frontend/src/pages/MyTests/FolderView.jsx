import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as folderService from '../../services/folderService';
import LibraryTestCard from './LibraryTestCard';
import { AddTestsDialog, ChooseFolderDialog } from './FolderDialogs';
import { toRef, pluralize, describeAddResult, describeMoveResult } from './folderUtils';

/* ─── FolderView — NEW ────────────────────────────────────────────────────────
   Inside one open folder: its tests, plus Add Tests, Move, Remove.

   Data: loads its own contents with GET /api/folders/:id (only the tests that
   are actually in this folder are fetched). The parent (MyTests.jsx) supplies:
     • `folders`  — the live folder list (so a rename shows up here at once,
                    and so Move knows the possible destinations)
     • `library`  — every test, used to build the "Add Tests" candidate list
     • onRename / onDelete — the parent owns those dialogs because the Folders
                    tab uses them too
     • onChanged  — call after any change so the parent refreshes its folder
                    counts and each test's "In N folders" badge
     • notify     — shows a success / warning / error notice at the top

   Removing a test here removes ONLY its link to this folder. The test, its
   questions, attempts and results are untouched, and its links to other
   folders are kept. If this was its last folder it reappears in Unorganized.
────────────────────────────────────────────────────────────────────────────── */

export default function FolderView({ folderId, folders, library, onRename, onDelete, onChanged, notify }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'load-error' | 'ready'
  const [loadError, setLoadError] = useState('');
  const [data, setData] = useState(null); // { folder, items }
  const [showAdd, setShowAdd] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);

  const reload = useCallback(async () => {
    setData(await folderService.getFolder(folderId));
  }, [folderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await folderService.getFolder(folderId);
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load this folder.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, [folderId]);

  const items = useMemo(() => (data ? data.items : []), [data]);

  // Prefer the parent's live copy of the folder so a rename appears immediately.
  const liveFolder = folders.find(f => f.id === folderId);
  const folderName = liveFolder ? liveFolder.name : (data ? data.folder.name : '');

  const candidates = useMemo(() => {
    const inFolder = new Set(items.map(i => i.key));
    return library.filter(entry => entry.attempted && !inFolder.has(entry.key));
  }, [library, items]);

  async function refreshAfterChange() {
    try {
      await Promise.all([reload(), onChanged()]);
    } catch (err) {
      notify({ type: 'error', text: err.message || 'The list could not be refreshed. Please reload the page.' });
    }
  }

  async function handleAdd(refs) {
    const result = await folderService.addItems(folderId, refs); // rejects → dialog shows the error
    setShowAdd(false);
    notify(describeAddResult(result, folderName));
    await refreshAfterChange();
  }

  async function handleRemove(item) {
    try {
      await folderService.removeItems(folderId, [toRef(item)]);
      notify({ type: 'success', text: `Removed “${item.title}” from “${folderName}”. The test itself was kept.` });
      await refreshAfterChange();
    } catch (err) {
      notify({ type: 'error', text: err.message || 'Could not remove this test from the folder.' });
    }
  }

  async function handleMove(destinationId) {
    const destination = folders.find(f => f.id === destinationId);
    const result = await folderService.moveItems(folderId, destinationId, [toRef(moveTarget)]);
    setMoveTarget(null);
    notify(describeMoveResult(result, destination ? destination.name : 'the other folder'));
    await refreshAfterChange();
  }

  if (status === 'loading') {
    return (
      <div className="mytests-load-wrap" role="status">
        <p className="mytests-load-text">Loading folder…</p>
      </div>
    );
  }

  if (status === 'load-error') {
    return (
      <div className="mytests-load-wrap">
        <h2 className="mytests-load-title">Couldn't open this folder</h2>
        <p className="mytests-load-text">{loadError}</p>
        <Link to="/my-tests?tab=folders" className="btn btn--primary">Back to Folders</Link>
      </div>
    );
  }

  const folderForActions = { id: folderId, name: folderName, itemCount: items.length };

  return (
    <section aria-label={`Folder ${folderName}`}>
      <Link to="/my-tests?tab=folders" className="mtf-back-link"><ArrowLeftIcon />All folders</Link>
      
      <div className="mtf-folder-header">
        <div>
          <h2 className="mtf-folder-title">{folderName}</h2>
          <p className="mytests-subtitle">{pluralize(items.length, 'test')} in this folder.</p>
        </div>
        <div className="mtf-folder-header__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAdd(true)}>
            Add Tests
          </button>
          <button type="button" className="btn mtf-quiet" onClick={() => onRename(folderForActions)}>
            Rename
          </button>
          <button type="button" className="dmodal-btn dmodal-btn--delete" onClick={() => onDelete(folderForActions)}>
            Delete Folder
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mytests-empty">
          <p className="mytests-empty__title">This folder is empty</p>
          <p className="mytests-empty__body">Add tests you have attempted to organize them here.</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAdd(true)}>Add Tests</button>
        </div>
      ) : (
        <div className="mytests-grid">
          {items.map(item => (
            <LibraryTestCard
              key={item.key}
              item={item}
              context="folder"
              onMove={setMoveTarget}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddTestsDialog
          folderName={folderName}
          candidates={candidates}
          onSubmit={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {moveTarget && (
        <ChooseFolderDialog
          title={`Move “${moveTarget.title}”`}
          intro="The test is added to the folder you choose and removed from this one. Its other folders are not affected."
          folders={folders.filter(f => f.id !== folderId)}
          confirmLabel="Move Test"
          emptyMessage="You have no other folders yet. Create one from the Folders tab first."
          onSubmit={handleMove}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </section>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}