import { redirect } from 'next/navigation';

// The app lives at /overview. This replaces the old three.js splash screen.
export default function RootPage() {
  redirect('/overview');
}
