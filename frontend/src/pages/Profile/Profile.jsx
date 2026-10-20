import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Profile.css';

const PASSWORD_MIN_LENGTH = 8;
const DELETE_CONFIRM_PHRASE = 'DELETE';

/* ─── Profile — "About My Profile" ────────────────────────────────────────────
   Protected route (wrapped in <ProtectedRoute> in App.jsx, same as every
   other personal page) — a logged-out visitor never reaches this, they're
   redirected to /login automatically.

   No fetch-on-mount needed to VIEW the profile — name/email already live
   in AuthContext from the initial /auth/me check. Only editing and
   deleting involve real API calls.

   Two independent things can be saved together on one "Save Changes"
   click: the name, and/or a password change — whichever the user
   actually filled in. Leaving the password fields blank means "no
   password change requested," not an error.
────────────────────────────────────────────────────────────────────────────── */

export default function Profile() {
  const { user, updateProfile, changePassword, deleteAccount, updateGeminiApiKey } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('view'); // 'view' | 'edit'

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  // const [originalGeminiApiKey, setOriginalGeminiApiKey] = useState('');
  const [showGeminiApiKey, setShowGeminiApiKey] = useState(false);
  // const [isLoadingKey, setIsLoadingKey] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  //gemini patch 3
  async function enterEditMode() {
    setName(user?.name || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setGeminiApiKey('');       // always starts blank — the real key is never fetched
    setShowGeminiApiKey(false);
    setEditError('');
    setEditSuccess('');
    setShowGeminiApiKey(false);
    setMode('edit');

    //No longer needed. to secure gemini api key
    // setIsLoadingKey(true);
    // try {
    //   const key = await getGeminiApiKey();
    //   setGeminiApiKey(key || '');
    //   setOriginalGeminiApiKey(key || '');
    // } catch (err) {
    //   setEditError('Could not load your current API key. You can still enter a new one below.');
    // } finally {
    //   setIsLoadingKey(false);
    // }
  }

  function cancelEdit() {
    setMode('view');
    setEditError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    const wantsPasswordChange = !!(currentPassword || newPassword || confirmPassword);
    const wantsKeyChange = !!geminiApiKey.trim(); // blank = "no change requested," same as the password fields


    if (!name.trim()) {
      setEditError('Name cannot be empty.');
      return;
    }

    // gemini patch 3
    if (wantsKeyChange && geminiApiKey.trim().length < 20) {
      setEditError('Please provide a valid Gemini API key, or leave the field blank to keep your current one.');
      return;
    }


    if (wantsPasswordChange) {
      if (!currentPassword) {
        setEditError('Enter your current password to set a new one.');
        return;
      }
      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        setEditError(`New password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
        return;
      }
      if (newPassword !== confirmPassword) {
        setEditError('New passwords do not match.');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (name.trim() !== user.name) {
        await updateProfile(name.trim());
      }
      if (wantsPasswordChange) {
        await changePassword(currentPassword, newPassword);
      }

      // gemini patch 3
      if (wantsKeyChange) {
        await updateGeminiApiKey(geminiApiKey.trim());
      }

      setEditSuccess('Your profile has been updated.');
      setMode('view');
    } catch (err) {
      setEditError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      navigate('/', { replace: true });
    } catch (err) {
      setIsDeleting(false);
      setDeleteError(err.message || 'Could not delete your account. Please try again.');
    }
  }

  if (!user) return null;

  return (
    <main className="page-wrapper">
      <div className="profile">

        <header className="profile-header">
          <h1 className="profile-title">About My Profile</h1>
          <p className="profile-subtitle">Manage your account details.</p>
        </header>

        <div className="profile-card">
          <div className="profile-card__content">
            {mode === 'view' ? (
              <>
                <div className="profile-field">
                  <span className="profile-field__label">Name</span>
                  <span className="profile-field__value">{user.name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field__label">Email</span>
                  <span className="profile-field__value">{user.email}</span>
                </div>

                {/* gemini patch 3 */}
                <div className="profile-field">
                  <span className="profile-field__label">Gemini API Key</span>
                  <span className="profile-field__value">
                    •••••••••••••••• <span className="profile-field__status">Set</span>
                  </span>
                </div>


                {editSuccess && (
                  <p className="profile-success" role="status">
                    <CheckIcon /> {editSuccess}
                  </p>
                )}

                <div className="profile-card-actions">
                  <button className="btn btn--primary" onClick={enterEditMode}>
                    Edit My Profile
                  </button>
                </div>
              </>
            ) : (
              <form className="profile-form" onSubmit={handleSave} noValidate>
                <div className="profile-form__field">
                  <label className="profile-form__label" htmlFor="profile-name">Name</label>
                  <input
                    id="profile-name"
                    type="text"
                    className="profile-form__input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                {/* gemini patch 3 */}
                <div className="profile-form__field">
                  <label className="profile-form__label" htmlFor="profile-gemini-key">Gemini API Key</label>
                  <div className="profile-form__input-with-toggle">
                    <input
                      id="profile-gemini-key"
                      type={showGeminiApiKey ? 'text' : 'password'}
                      className="profile-form__input"
                      value={geminiApiKey}
                      onChange={e => setGeminiApiKey(e.target.value)}
                      autoComplete="off"
                      placeholder="Leave blank to keep your current key"
                    />
                    <button
                      type="button"
                      className="profile-form__input-toggle"
                      onClick={() => setShowGeminiApiKey(s => !s)}
                      aria-label={showGeminiApiKey ? 'Hide' : 'Show'}
                    >
                      {showGeminiApiKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="profile-form__hint">
                    For your security, your existing key is never displayed here. Only
                    enter a new one if you want to replace it.
                  </p>
                </div>



                <div className="profile-form__divider">
                  <span>Change Password</span>
                  <span className="profile-form__divider-hint">(leave blank to keep your current password)</span>
                </div>

                <div className="profile-form__field">
                  <label className="profile-form__label" htmlFor="profile-current-password">Current password</label>
                  <input
                    id="profile-current-password"
                    type="password"
                    className="profile-form__input"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div className="profile-form__field">
                  <label className="profile-form__label" htmlFor="profile-new-password">New password</label>
                  <input
                    id="profile-new-password"
                    type="password"
                    className="profile-form__input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                  />
                </div>

                <div className="profile-form__field">
                  <label className="profile-form__label" htmlFor="profile-confirm-password">Confirm new password</label>
                  <input
                    id="profile-confirm-password"
                    type="password"
                    className="profile-form__input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                {editError && (
                  <p className="profile-error" role="alert">
                    <ErrorIcon /> {editError}
                  </p>
                )}

                <div className="profile-form__actions">
                  <button type="button" className="btn btn--ghost" onClick={cancelEdit} disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save Changes'}
                  </button>

              </div>
              </form>
            )}
          </div>
        </div>

        <div className="profile-danger-zone">
          <h2 className="profile-danger-zone__title">Danger Zone</h2>
          <div className="profile-danger-zone__card">
            <div>
              <p className="profile-danger-zone__label">Delete My Profile</p>
              <p className="profile-danger-zone__body">
                Permanently deletes your account and every test, question,
                and attempt associated with it. This cannot be undone.
              </p>
            </div>
            <button className="dmodal-btn dmodal-btn--delete" onClick={() => setShowDeleteModal(true)}>
              Delete My Profile
            </button>
          </div>
        </div>

      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          error={deleteError}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setDeleteError('');
          }}
        />
      )}
    </main>
  );
}

/* ─── DeleteAccountModal ──────────────────────────────────────────────────
   Stronger confirmation than the usual delete-this-test modal (Dashboard,
   MyTests) since this destroys EVERYTHING, not one item — requires
   typing the word DELETE exactly before the button even enables, the
   same well-established pattern GitHub uses for repo deletion.
────────────────────────────────────────────────────────────────────────────── */

function DeleteAccountModal({ confirmText, onConfirmTextChange, error, isDeleting, onConfirm, onCancel }) {
  const canDelete = confirmText === DELETE_CONFIRM_PHRASE;

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
      aria-labelledby="delete-account-title"
    >
      <div className="dmodal-card">
        <h2 className="dmodal-title" id="delete-account-title">Delete your account?</h2>
        <p className="dmodal-body">
          This permanently deletes your account and every test, question,
          source, and attempt you've ever created. There is no way to
          recover this data afterward.
        </p>

        <label className="profile-form__label" htmlFor="delete-confirm-input">
          Type <strong>{DELETE_CONFIRM_PHRASE}</strong> to confirm
        </label>
        <input
          id="delete-confirm-input"
          type="text"
          className="profile-form__input"
          value={confirmText}
          onChange={e => onConfirmTextChange(e.target.value)}
          autoComplete="off"
          disabled={isDeleting}
        />

        {error && (
          <p className="dmodal-error" role="alert">
            <ErrorIcon /> {error}
          </p>
        )}

        <div className="dmodal-actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button className="dmodal-btn dmodal-btn--delete" onClick={onConfirm} disabled={!canDelete || isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────*/

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="3" />
      <path d="M4.3 7l1.9 1.9L9.7 4.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
