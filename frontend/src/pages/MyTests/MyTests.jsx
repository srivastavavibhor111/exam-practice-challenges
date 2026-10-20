import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as dashboardService from '../../services/dashboardService';
import * as folderService from '../../services/folderService';
import FolderSection from './FolderSection';
import FolderView from './FolderView';
import FolderNotice from './FolderNotice';
import LibraryTestCard from './LibraryTestCard';
import { FolderNameDialog, ChooseFolderDialog, DeleteFolderDialog } from './FolderDialogs';
import { pluralize, toRef, describeAddResult, describeDeleteResult } from './folderUtils';
import './MyTests.css';
import './MyTestsFolders.css';

/* ─── MyTests — NEW ───────────────────────────────────────────────────────────
   The full list of every test the user has created (Dashboard's "Recent
   Tests" section deliberately caps at 6 — this page shows all of them,
   with a simple search-by-title filter since the list has no ceiling).

   No new backend endpoints needed — this reuses dashboardService.getTests()
   and dashboardService.deleteTest() exactly as Dashboard.jsx already does,
   including the same cascade-delete behavior (M14) and the same
   confirmation modal pattern.

   Route protection: this page is wrapped in <ProtectedRoute> in App.jsx,
   the same way every other personal-workspace page is (Dashboard,
   Bookmarks, Mistakes, Create Test, etc.) — visiting it while logged out
   redirects straight to /login automatically. No special-case logic is
   needed here for that; it's inherited for free from the routing layer.
────────────────────────────────────────────────────────────────────────────── */

// function formatDate(dateStr) {
//   if (!dateStr) return '';
//   return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
// }

/* ─── CHANGED for Custom Test Folders ─────────────────────────────────────────
   This page no longer reads dashboardService.getTests(). It loads the "library"
   (GET /api/folders/library/all — every test, attempted or not, plus shared
   tests you have completed) and your folders (GET /api/folders), and shows
   three sections: Folders / Unorganized / All Tests.
   Deleting a single test still uses dashboardService.deleteTest() and the same
   confirmation modal below — unchanged. The Dashboard is not affected.
────────────────────────────────────────────────────────────────────────────── */

const TABS = [
  { id: 'folders',     label: 'Folders' },
  { id: 'unorganized', label: 'Unorganized' },
  { id: 'all',         label: 'All Tests' },
];

export default function MyTests() {
  // Which section is showing lives in the URL (?tab=…&folder=…), so the browser
  // Back button, refresh, and "open in new tab" all behave naturally.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = TABS.some(t => t.id === requestedTab) ? requestedTab : 'all';
  const openFolderId = tab === 'folders' ? searchParams.get('folder') : null;

  const [status,    setStatus]    = useState('loading'); // 'loading' | 'load-error' | 'ready'
  const [loadError, setLoadError] = useState('');
  const [library,   setLibrary]   = useState([]); // every test shown in My Tests (see LibraryTestCard)
  const [folders,   setFolders]   = useState([]);
  const [search,    setSearch]    = useState('');
  const [notice,    setNotice]    = useState(null);

  const [folderDialog,      setFolderDialog]      = useState(null); // { mode: 'create' } | { mode: 'rename', folder }
  const [folderToDelete,    setFolderToDelete]    = useState(null);
  const [addToFolderTarget, setAddToFolderTarget] = useState(null); // a library item

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  const fetchAll = useCallback(async () => {
    const [libraryItems, folderList] = await Promise.all([
      folderService.getLibrary(),
      folderService.getFolders(),
    ]);
    return { libraryItems, folderList };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { libraryItems, folderList } = await fetchAll();
        if (cancelled) return;
        setLibrary(libraryItems);
        setFolders(folderList);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load your tests.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, [fetchAll]);

  // Re-reads the library and folders after any change, so counts, badges and
  // the Unorganized list always reflect what the server actually has.
  const refresh = useCallback(async () => {
    try {
      const { libraryItems, folderList } = await fetchAll();
      setLibrary(libraryItems);
      setFolders(folderList);
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Could not refresh your tests. Please reload the page.' });
    }
  }, [fetchAll]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  // Unorganized = attempted tests that are in no folder. (Same rule the server
  // uses for GET /api/folders/library/unorganized — derived here from the one
  // library response so we make one request instead of two.)
  const unorganized = useMemo(
    () => library.filter(item => item.attempted && item.folderCount === 0),
    [library]
  );

  const tabCounts = { folders: folders.length, unorganized: unorganized.length, all: library.length };

  const listItems = tab === 'unorganized' ? unorganized : library;

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return listItems;
    return listItems.filter(item => item.title.toLowerCase().includes(query));
  }, [listItems, search]);

  function selectTab(id) {
    setSearch('');
    setSearchParams({ tab: id });
  }

  async function handleSaveFolderName(name) {
    if (folderDialog.mode === 'create') {
      await folderService.createFolder(name); // rejects → the dialog shows the error and stays open
      setNotice({ type: 'success', text: `Folder “${name}” created.` });
    } else {
      await folderService.renameFolder(folderDialog.folder.id, name);
      setNotice({ type: 'success', text: `Folder renamed to “${name}”.` });
    }
    setFolderDialog(null);
    await refresh();
  }

  async function handleConfirmDeleteFolder(mode) {
    const target = folderToDelete;
    const result = await folderService.deleteFolder(target.id, mode);
    setFolderToDelete(null);
    setNotice({ type: 'success', text: describeDeleteResult(result, target.name) });
    if (openFolderId === target.id) setSearchParams({ tab: 'folders' });
    await refresh();
  }

  async function handleAddToFolder(folderId) {
    const item = addToFolderTarget;
    const folder = folders.find(f => f.id === folderId);
    const result = await folderService.addItems(folderId, [toRef(item)]);
    setAddToFolderTarget(null);
    setNotice(describeAddResult(result, folder ? folder.name : 'the folder'));
    await refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await dashboardService.deleteTest(deleteTarget.itemId);
      setNotice({ type: 'success', text: `Deleted “${deleteTarget.title}”.` });
      setDeleteTarget(null);
      await refresh(); // the server also removed its folder links
    } catch (err) {
      setDeleteError(err.message || 'Could not delete this test. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  if (status === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="mytests-load-wrap">
          <span className="mytests-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="mytests-load-text">Loading your tests…</p>
        </div>
      </main>
    );
  }

  if (status === 'load-error') {
    return (
      <main className="page-wrapper">
        <div className="mytests-load-wrap">
          <span className="mytests-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="mytests-load-title">Couldn't load your tests</h1>
          <p className="mytests-load-text">{loadError}</p>
          <Link to="/dashboard" className="btn btn--primary">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const hasAnyAttempted = library.some(item => item.attempted);

  return (
    <main className="page-wrapper">
      <div className="mytests">

        <header className="mytests-header">
          <div>
            <h1 className="mytests-title">My Tests</h1>
            <p className="mytests-subtitle">
              {pluralize(library.length, 'test')} · {pluralize(folders.length, 'folder')}
            </p>
          </div>
          <Link to="/create" className="btn btn--primary">
            <PlusIcon /> Create New Test
          </Link>
        </header>

        <nav className="mtf-tabs" aria-label="My Tests sections">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`mtf-tab${tab === t.id ? ' mtf-tab--active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => selectTab(t.id)}
            >
              {t.label}
              <span className="mtf-tab__count">{tabCounts[t.id]}</span>
            </button>
          ))}
        </nav>

        <FolderNotice notice={notice} onDismiss={dismissNotice} />

        {tab === 'folders' ? (
          openFolderId ? (
            <FolderView
              key={openFolderId}
              folderId={openFolderId}
              folders={folders}
              library={library}
              onRename={folder => setFolderDialog({ mode: 'rename', folder })}
              onDelete={setFolderToDelete}
              onChanged={refresh}
              notify={setNotice}
            />
          ) : (
            <FolderSection
              folders={folders}
              onCreate={() => setFolderDialog({ mode: 'create' })}
              onRename={folder => setFolderDialog({ mode: 'rename', folder })}
              onDelete={setFolderToDelete}
            />
          )
        ) : (
          <>
            {listItems.length > 0 && (
              <div className="mytests-search">
                <SearchIcon />
                <input
                  type="text"
                  className="mytests-search-input"
                  placeholder="Search your tests by title…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search your tests by title"
                />
              </div>
            )}

            {listItems.length === 0 ? (
              tab === 'unorganized' ? (
                <div className="mytests-empty">
                  <p className="mytests-empty__title">Nothing to organize</p>
                  <p className="mytests-empty__body">
                    {hasAnyAttempted
                      ? 'Every test you have attempted is already in a folder.'
                      : 'Tests you have attempted and submitted show up here until you put them in a folder.'}
                  </p>
                </div>
              ) : (
                <div className="mytests-empty">
                  <p className="mytests-empty__title">No tests yet</p>
                  <p className="mytests-empty__body">Create your first test to get started.</p>
                  <Link to="/create" className="btn btn--primary btn--sm">Create Your First Test</Link>
                </div>
              )
            ) : filteredItems.length === 0 ? (
              <div className="mytests-empty">
                <p className="mytests-empty__title">No matches</p>
                <p className="mytests-empty__body">No tests match "{search}".</p>
              </div>
            ) : (
              <div className="mytests-grid">
                {filteredItems.map(item => (
                  <LibraryTestCard
                    key={item.key}
                    item={item}
                    context="library"
                    onAddToFolder={setAddToFolderTarget}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {folderDialog && (
        <FolderNameDialog
          mode={folderDialog.mode}
          initialName={folderDialog.mode === 'rename' ? folderDialog.folder.name : ''}
          onSubmit={handleSaveFolderName}
          onClose={() => setFolderDialog(null)}
        />
      )}

      {folderToDelete && (
        <DeleteFolderDialog
          folder={folderToDelete}
          onConfirm={handleConfirmDeleteFolder}
          onClose={() => setFolderToDelete(null)}
        />
      )}

      {addToFolderTarget && (
        <ChooseFolderDialog
          title={`Add “${addToFolderTarget.title}” to a folder`}
          intro="The test stays where it is — this only adds it to a folder. A test can be in several folders."
          folders={folders}
          confirmLabel="Add to Folder"
          emptyMessage="You don't have any folders yet. Create one from the Folders tab first."
          onSubmit={handleAddToFolder}
          onClose={() => setAddToFolderTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          test={deleteTarget}
          error={deleteError}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
    </main>
  );
}


/* ─── DeleteConfirmModal (same pattern as Dashboard.jsx) ──────────────────*/

function DeleteConfirmModal({ test, error, isDeleting, onConfirm, onCancel }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="dmodal-backdrop"
      onClick={e => e.target === e.currentTarget && !isDeleting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mytests-delete-title"
    >
      <div className="dmodal-card">
        <div className="dmodal-content">
          <h2 className="dmodal-title" id="mytests-delete-title">Delete "{test.title}"?</h2>
          <p className="dmodal-body">
            This will permanently delete this test, its {test.questionCount} {test.questionCount === 1 ? 'question' : 'questions'},
            and any attempts you've made on it. This can't be undone.
          </p>

          {error && (
            <p className="dmodal-error" role="alert">
              <ErrorIcon /> {error}
            </p>
          )}
        </div>
        <div className="dmodal-actions">
          <button className="btn mtf-quiet" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button className="dmodal-btn dmodal-btn--delete" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────*/

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 2.5v10M2.5 7.5h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

// function TrashIcon() {
//   return (
//     <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
//       <path d="M2.5 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
//       <path d="M11.8 4l-.7 8.5a1 1 0 01-1 .9H4.9a1 1 0 01-1-.9L3.2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
//     </svg>
//   );
// }

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ErrorBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 12v10M20 26v1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="mytests-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25"/>
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
