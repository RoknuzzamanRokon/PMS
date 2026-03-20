import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";

export const metadata = {
  title: "Hotel PMS Frontend",
  description: "Next.js frontend recreated from the UI HTML files.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var savedTheme = localStorage.getItem("inno-rooms-theme") || "system";
                  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  var resolvedTheme = savedTheme === "system" ? (prefersDark ? "dark" : "light") : savedTheme;
                  var isDarkFamily = resolvedTheme === "dark" || resolvedTheme === "midnight";
                  var root = document.documentElement;
                  root.classList.toggle("dark", isDarkFamily);
                  root.dataset.theme = resolvedTheme;
                  root.style.colorScheme = isDarkFamily ? "dark" : "light";
                } catch (error) {}
              })();
            `,
          }}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="font-display" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
