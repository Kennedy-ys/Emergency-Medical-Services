import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { classifyError } from '../../lib/supabase';
import { errorText } from '../../lib/status';

/** The current time, refreshed on an interval so waiting times stay honest. */
export function useNow(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** "under 1 min", "7 min", "2 h 5 min". */
export function formatElapsed(fromIso, now) {
  const minutes = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 1) return 'under 1 min';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const dateTime = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '');

/**
 * Builds the text of a CSV file. `columns` is a list of [heading, (row) => value].
 * Cells that a spreadsheet would run as a formula are made plain text.
 */
export function toCsv(rows, columns) {
  const cell = (value) => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map(([heading]) => cell(heading)),
    ...rows.map((row) => columns.map(([, get]) => cell(get(row)))),
  ];
  return lines.map((line) => line.join(',')).join('\r\n');
}

/** Hands the browser a text file to save. */
export function downloadText(filename, text, type = 'text/csv') {
  // The leading mark makes Excel read the file as UTF-8.
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Shows a server refusal in plain words, or a connection message. */
export function reportFailure(error) {
  const { kind, code } = classifyError(error);
  toast.error(
    kind === 'business' ? errorText(code) : 'Could not save. Check your connection and try again.'
  );
}
