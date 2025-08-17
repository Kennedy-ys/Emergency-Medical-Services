export function Button({ children, ...props }) {
  return (
    <button
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
      {...props}
    >
      {children}
    </button>
  );
}
