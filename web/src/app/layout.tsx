export const metadata = {
  title: "Reach Loop",
  description: "Where Finnish cancer care falls short of national targets, Region by Region.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
