import React, { useState } from 'react';
import { FaSearch, FaHeartbeat, FaBandAid, FaFireExtinguisher } from 'react-icons/fa';

const dummyTips = [
  {
    id: 1,
    title: "CPR (Cardiopulmonary Resuscitation)",
    icon: <FaHeartbeat />,
    content: "Place the heel of your hand on the center of the person's chest. Push hard and fast. Give 30 compressions followed by 2 rescue breaths. Repeat."
  },
  {
    id: 2,
    title: "Bleeding Control",
    icon: <FaBandAid />,
    content: "Apply direct pressure on the wound with a clean cloth. Elevate the injured area if possible. Don’t remove embedded objects."
  },
  {
    id: 3,
    title: "Burns",
    icon: <FaFireExtinguisher />,
    content: "Cool the burn under running water for at least 10 minutes. Don’t apply oils or butter. Cover loosely with a clean cloth."
  },
];

const FirstAidTips = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openTipId, setOpenTipId] = useState(null);

  const filteredTips = dummyTips.filter(tip =>
    tip.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTip = (id) => {
    setOpenTipId(openTipId === id ? null : id);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4 text-center">🩺 First Aid Tips</h1>
      
      <div className="flex items-center bg-gray-100 rounded px-3 py-2 mb-6">
        <FaSearch className="text-gray-500 mr-2" />
        <input
          type="text"
          placeholder="Search tips..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent outline-none w-full"
        />
      </div>

      <div className="space-y-4">
        {filteredTips.map((tip) => (
          <div key={tip.id} className="border rounded shadow-sm">
            <button
              onClick={() => toggleTip(tip.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl text-blue-600">{tip.icon}</span>
                <span className="font-medium">{tip.title}</span>
              </div>
              <span>{openTipId === tip.id ? '−' : '+'}</span>
            </button>

            {openTipId === tip.id && (
              <div className="px-4 py-3 bg-gray-50 text-sm text-gray-700">
                {tip.content}
              </div>
            )}
          </div>
        ))}

        {filteredTips.length === 0 && (
          <p className="text-center text-gray-500 mt-8">No tips found.</p>
        )}
      </div>
    </div>
  );
};

export default FirstAidTips;
