
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import Layout from "@/components/Layout";
import Home from "./pages/Home";
import { pageLoaders } from "@/lib/pageLoaders";

// Les autres pages sont chargées à la demande (site plus rapide au premier affichage)
const Projects = lazy(pageLoaders.projects);
const ProjectGallery = lazy(pageLoaders.project);
const About = lazy(pageLoaders.about);
const Contact = lazy(pageLoaders.contact);
const Cv = lazy(pageLoaders.cv);
const Chatbot = lazy(pageLoaders.chatbot);
const Games = lazy(pageLoaders.games);
const NotFound = lazy(pageLoaders.notFound);
const Legal = lazy(pageLoaders.legal);
// Notifications (formulaire, Jarvis, admin) : chargées juste après le premier affichage
const Sonner = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-[100svh] items-center justify-center" aria-hidden="true" data-page-fallback>
    <span className="led animate-pulse text-2xl text-primary">···</span>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <Suspense fallback={null}>
          <Sonner />
        </Suspense>
        <BrowserRouter>
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:projectId" element={<ProjectGallery />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/cv" element={<Cv />} />
                <Route path="/chatbot" element={<Chatbot />} />
                <Route path="/games" element={<Games />} />
                <Route path="/mentions-legales" element={<Legal />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </ThemeProvider>
    </I18nextProvider>
  </QueryClientProvider>
);

export default App;
