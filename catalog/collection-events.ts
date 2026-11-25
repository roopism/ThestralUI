export const events = Array.from({ length: 5000 }, (_, i) => ({
  id: String(i + 1),
  name: 'Event ' + (i + 1),
  duration: (i * 79) % 3600,
}));
