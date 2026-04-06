import "./globals.css";
import { ThemeProvider } from "../components/theme-provider";

export const metadata = {
  title: "Inno PMS Frontend",
  description: "Next.js frontend recreated from the UI HTML files.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ colorScheme: "light" }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var savedTheme = localStorage.getItem("inno-rooms-theme") || "light";
                  var resolvedTheme = (savedTheme === "system" || !savedTheme) ? "light" : savedTheme;
                  var isDarkFamily = resolvedTheme === "dark" || resolvedTheme === "midnight";
                  var root = document.documentElement;
                  if (isDarkFamily) {
                    root.classList.add("dark");
                  } else {
                    root.classList.remove("dark");
                  }
                  root.dataset.theme = resolvedTheme;
                  root.style.colorScheme = isDarkFamily ? "dark" : "light";
                  root.style.background = "var(--app-bg)";
                  root.style.color = "var(--app-fg)";
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
