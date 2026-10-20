import { Link } from 'react-router-dom';
import { pluralize } from './folderUtils';

/* ─── FolderSection — NEW ─────────────────────────────────────────────────────
   The "Folders" tab: the user's folders as cards, plus Create Folder.
   Purely presentational — it receives the folder list and callbacks from
   MyTests.jsx, which owns the data and the dialogs.

   Opening a folder is a real <Link> to ?tab=folders&folder=<id>, so the
   browser Back button and "open in new tab" both work with no extra routing.
────────────────────────────────────────────────────────────────────────────── */

export default function FolderSection({ folders, onCreate, onRename, onDelete }) {
  return (
    <section aria-label="Your folders">
      <div className="mtf-section-bar">
        <p className="mtf-section-note">Group your attempted tests however you like.</p>
        <button type="button" className="btn btn--primary btn--sm" onClick={onCreate}>
          <PlusIcon /> Create Folder
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="mytests-empty">
          <p className="mytests-empty__title">No folders yet</p>
          <p className="mytests-empty__body">
            Create a folder such as “Python Revision”, then add the tests you have attempted to it.
          </p>
          <button type="button" className="btn btn--primary btn--sm" onClick={onCreate}>Create Your First Folder</button>
        </div>
      ) : (
        <ul className="mtf-folder-grid">
          {folders.map(folder => (
            <li key={folder.id} className="mytests-card mtf-folder-card">
              <Link
                to={`/my-tests?tab=folders&folder=${folder.id}`}
                className="mtf-folder-card__open"
              >
                <span className="mtf-folder-card__icon" aria-hidden="true"><FolderIcon /></span>
                <span className="mtf-folder-card__text">
                  <span className="mtf-folder-card__name">{folder.name}</span>
                  <span className="mtf-folder-card__count">{pluralize(folder.itemCount, 'test')}</span>
                </span>
              </Link>
              <div className="mtf-folder-card__actions">
                <button
                  type="button"
                  className="mtf-icon-btn"
                  onClick={() => onRename(folder)}
                  aria-label={`Rename folder ${folder.name}`}
                  title="Rename folder"
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="mytests-card__delete"
                  onClick={() => onDelete(folder)}
                  aria-label={`Delete folder ${folder.name}`}
                  title="Delete folder"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 2.5v10M2.5 7.5h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M2.5 6a1.5 1.5 0 011.5-1.5h4l1.8 2H18A1.5 1.5 0 0119.5 8v8A1.5 1.5 0 0118 17.5H4A1.5 1.5 0 012.5 16V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2.5 12.5l.7-2.9 6.6-6.6a1.2 1.2 0 011.7 0l.5.5a1.2 1.2 0 010 1.7l-6.6 6.6-2.9.7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.6 4.3l2.1 2.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2.5 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 4l-.7 8.5a1 1 0 01-1 .9H4.9a1 1 0 01-1-.9L3.2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
