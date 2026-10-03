import './globals.css';

export const metadata = {
  title: 'BJT TECH — NZ PC parts, priced daily',
  description: 'BJT TECH tracks sharp New Zealand PC component prices.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
