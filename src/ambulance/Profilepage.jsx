import React, { useState, useEffect } from 'react';
import { getDriverData, updateDriverProfile } from '../utils/dbHelpers';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

function ProfilePage() {
  const { ambulanceId } = useParams(); // fixed: add ()
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [section, setSection] = useState('personal'); // for navigation

  // Fetch profile data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getDriverData(ambulanceId);
        if (data) {
          setProfile(data);
          setName(data.driverName || '');
          setPhone(data.driverPhone || '');
          setProfilePic(data.profilePicUrl || null); // assuming URL stored
        }
      } catch (err) {
        toast.error('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ambulanceId]);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.warning('Please fill in all fields.');
      return;
    }
    setSaving(true);
    try {
      await updateDriverProfile(ambulanceId, {
        ...profile,
        driverName: name,
        driverPhone: phone,
        profilePicUrl: profilePic,
      });
      toast.success('Profile updated successfully!');
      setEditMode(false);
    } catch (err) {
      toast.error('Error updating profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // For demo, display immediate preview
      const reader = new FileReader();
      reader.onload = () => {
        setProfilePic(reader.result); // base64 image URL
      };
      reader.readAsDataURL(file);
      // optionally, upload the image to server here
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans">
      {/* Navigation Sidebar */}
      <aside className="w-full md:w-64 bg-white shadow-md p-4 mb-4 md:mb-0">
        <h3 className="text-xl font-semibold mb-4">Profile Sections</h3>
        <ul className="space-y-2">
          <li>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-200 ${section==='personal' && 'bg-gray-200'}`}
              onClick={() => setSection('personal')}
            >
              Personal Info
            </button>
          </li>
          <li>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-200 ${section==='progress' && 'bg-gray-200'}`}
              onClick={() => setSection('progress')}
            >
              Progress
            </button>
          </li>
          <li>
            <button
              className={`w-full text-left px-3 py-2 rounded hover:bg-gray-200 ${section==='settings' && 'bg-gray-200'}`}
              onClick={() => setSection('settings')}
            >
              Settings
            </button>
          </li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {section === 'personal' && `Edit Profile: ${ambulanceId}`}
          {section === 'progress' && 'Progress Overview'}
          {section === 'settings' && 'Settings'}
        </h2>

        {section === 'personal' && (
          <div className="bg-white p-6 rounded shadow-lg space-y-4 lg:flex lg:space-x-6 items-center">
            {/* Profile Picture */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="w-24 h-24 mb-2 rounded-full overflow-hidden border-2 border-gray-300">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-200 text-gray-500 text-xl">No Image</div>
                )}
              </div>
              {editMode && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="text-sm text-gray-600"
                />
              )}
            </div>

            {/* Profile Details */}
            <div className="flex-1 space-y-4">
              {editMode ? (
                <>
                  <div>
                    <label className="block mb-1 font-semibold text-gray-700">Name</label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-semibold text-gray-700">Phone Number</label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p><strong>Name:</strong> {profile.driverName}</p>
                  <p><strong>Phone:</strong> {profile.driverPhone}</p>
                </>
              )}
              {/* Buttons */}
              <div className="flex space-x-4 mt-4">
                {!editMode ? (
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded"
                      onClick={() => {
                        // revert changes
                        setName(profile.driverName);
                        setPhone(profile.driverPhone);
                        setProfilePic(profile.profilePicUrl);
                        setEditMode(false);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {section === 'progress' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Example progress info; replace with real data */}
            <div className="bg-white p-4 rounded shadow text-center">
              <h3 className="text-xl font-semibold mb-2">Trips</h3>
              <p className="text-2xl">123</p>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <h3 className="text-xl font-semibold mb-2">Ratings</h3>
              <p className="text-2xl">4.8 / 5</p>
            </div>
            <div className="bg-white p-4 rounded shadow text-center">
              <h3 className="text-xl font-semibold mb-2">Earnings</h3>
              <p className="text-2xl">$5,000</p>
            </div>
          </div>
        )}

        {section === 'settings' && (
          <div className="bg-white p-6 rounded shadow-lg">
            {/* Placeholder for settings */}
            <p className="mb-4">Settings section content...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProfilePage;