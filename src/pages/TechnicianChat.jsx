import React, { useState, useRef } from 'react';

const dummyMessages = [
  { sender: 'user', text: 'Hello, I need help with someone who just fainted.', time: '2:31 PM' },
  { sender: 'technician', text: 'I’m here to help. Can you check if the person is breathing?', time: '2:32 PM' },
  { sender: 'user', text: 'Yes, but they’re unconscious.', time: '2:33 PM' },
  { sender: 'technician', text: 'Stay calm. Place them in the recovery position. Help is coming. Keep them on their side.', time: '2:34 PM' },
  { sender: 'user', text: 'ok, i have done that. What else should i do?', time: '2:34 pm' },
];

const TechnicianChat = () => {
  const [messages] = useState(dummyMessages);
  const [input, setInput] = useState('');
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert(`You selected image: ${file.name} (image sending not enabled in mock)`);
    }
  };

  const handleVoiceMessage = () => {
    alert('Voice recording is not available in this mock view.');
  };


  return (
    <div className="flex flex-col h-screen max-w-md mx-auto border shadow-md bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Chat with Technician</h2>
          <p className="text-sm text-gray-200">Paramedic - James Okoro</p>
        </div>
        <span className="bg-green-500 rounded-full h-4 w-4 inline-block"></span>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.sender === 'technician' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-xs p-3 rounded-lg shadow ${
                msg.sender === 'user'
                  ? 'bg-white text-gray-800'
                  : 'bg-blue-500 text-white'
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              <p className="text-xs mt-1 text-right opacity-70">{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t flex gap-2">
        <button
          onClick={() => fileInputRef.current.click()}
          className="text-xl p-2 rounded-full hover:bg-gray-200"
          title="Send Image"
        >
          🖼️
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Text Input */}
        <input
          type="text"
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />

        {/* Send Button */}
        <button
          onClick={() => alert('Message sending is disabled in this mock')}
          className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          Send
        </button>

        {/* Voice Button */}
        <button
          onClick={handleVoiceMessage}
          className="text-xl p-2 rounded-full hover:bg-gray-200"
          title="Voice Message"
        >
          🎤
        </button>
      </div>
    </div>
  );
};

export default TechnicianChat;
