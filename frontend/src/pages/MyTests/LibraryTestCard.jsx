import { Link } from 'react-router-dom';
import { formatDate, pluralize } from './folderUtils';

/* ─── LibraryTestCard — NEW ───────────────────────────────────────────────────
   One card for one entry from the My Tests "library" — a personal test OR a
   shared test the user has completed. It reuses the existing .mytests-card*
   styles (same look as before) and adds a few text badges. Nothing is copied
   from the original test: every field comes from the library entry the server
   built from the real Test / SharedTest / Attempt records.

   `context` decides which actions appear:
     'library'  (All Tests / Unorganized)  → Add to folder, Delete (personal only)
     'folder'   (inside a folder)          → Move, Remove from folder

   Status is always shown as TEXT badges (never colour alone).
────────────────────────────────────────────────────────────────────────────── */

export default function LibraryTestCard({ item, context, onAddToFolder, onDelete, onMove, onRemove }) {
  const isShared = item.itemType === 'sharedTest';
  const isExpired = isShared && item.status === 'expired';

  const takePath = isShared ? `/shared-tests/take/${item.sharedTestCode}` : `/test/${item.itemId}`;
  const resultPath = item.latestAttemptId
    ? (isShared ? `/shared-tests/result/${item.latestAttemptId}` : `/result/${item.latestAttemptId}`)
    : null;

  return (
    <div className="mytests-card">
      <div className="mytests-card__main">
        <h3 className="mytests-card__title">{item.title}</h3>
        <p className="mytests-card__meta">
          {pluralize(item.questionCount, 'question')} · {formatDate(item.createdAt)}
        </p>

        <ul className="mtf-badges" aria-label="Test details">
          {!item.attempted && <li className="mtf-badge mtf-badge--attention">Not attempted yet</li>}
          {isShared && <li className="mtf-badge mtf-badge--attention">Shared test</li>}
          {isExpired && <li className="mtf-badge mtf-badge--attention">Expired</li>}
          {item.isPracticeSet && <li className="mtf-badge">Practice set</li>}
          {context === 'library' && item.folderCount > 0 && (
            <li className="mtf-badge">In {pluralize(item.folderCount, 'folder')}</li>
          )}
        </ul>

        {item.attempted && (
          <p className="mytests-card__meta mtf-card__attempts">
            {pluralize(item.attemptCount, 'attempt')}
            {item.lastAttemptedAt ? ` · last ${formatDate(item.lastAttemptedAt)}` : ''}
            {resultPath && (
              <>
                {' · '}
                <Link to={resultPath} className="mtf-inline-link">View latest result</Link>
              </>
            )}
          </p>
        )}
      </div>

      <div className="mytests-card__actions">
        {isExpired ? (
          resultPath
            ? <Link to={resultPath} className="btn btn--primary btn--sm">View Result</Link>
            : <span className="mtf-muted-note">Expired</span>
        ) : (
          <Link to={takePath} className="btn btn--primary btn--sm">
            {item.attempted ? 'Take Again' : 'Take Test'}
          </Link>
        )}

        {context === 'library' && item.attempted && (
          <button
            type="button"
            className="mtf-icon-btn"
            onClick={() => onAddToFolder(item)}
            aria-label={`Add ${item.title} to a folder`}
            title="Add to a folder"
          >
            <FolderPlusIcon />
          </button>
        )}

        {context === 'library' && !isShared && (
          <button
            type="button"
            className="mytests-card__delete"
            onClick={() => onDelete(item)}
            aria-label={`Delete ${item.title}`}
            title="Delete this test"
          >
            <TrashIcon />
          </button>
        )}

        {context === 'folder' && (
          <>
            <button
              type="button"
              className="mtf-icon-btn"
              onClick={() => onMove(item)}
              aria-label={`Move ${item.title} to another folder`}
              title="Move to another folder"
            >
              <MoveIcon />
            </button>
            <button
              type="button"
              className="mtf-icon-btn"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item.title} from this folder`}
              title="Remove from this folder (the test itself is kept)"
            >
              <RemoveIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */

function FolderPlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M1.8 4.2a1 1 0 011-1h2.6l1.2 1.4h5.6a1 1 0 011 1v5.6a1 1 0 01-1 1H2.8a1 1 0 01-1-1V4.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7.5 6.8v3M6 8.3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 7.5h10M8.5 4l3.5 3.5L8.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l8 8M11.5 3.5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
