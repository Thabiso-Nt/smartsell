export const metadata = {
  title: "SmartSell",
  description: "Take a photo. Know whether it's worth selling.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
