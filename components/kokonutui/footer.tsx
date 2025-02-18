"use client"
import Link from "next/link"
import { Github, Instagram, Linkedin, Facebook, Twitter, ArrowUp, MountainSnow } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-[#111111] text-gray-300 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-12">
          {/* Left Column */}
          <div className="space-y-6">
            <Link href="/" className="inline-block">
              <div className="flex items-center space-x-2">
                <MountainSnow size={20} />
                <span className="text-white text-xl font-semibold">Waseem Akram</span>
              </div>
            </Link>

            <p className="text-gray-400 max-w-md">
              Open Source UI components built with Tailwind CSS for React and Next.js.
            </p>

            <div className="flex space-x-4">
              <Link href="#" className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                <Twitter size={20} />
              </Link>
              <Link href="#" className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                <Facebook size={20} />
              </Link>
              <Link href="#" className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                <Linkedin size={20} />
              </Link>
              <Link href="#" className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                <Instagram size={20} />
              </Link>
              <Link href="#" className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                <Github size={20} />
              </Link>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:flex lg:justify-left">
            <nav>
              <ul className="space-y-4 lg:text-left">
                <li>
                  <h2 className="font-bold">Features</h2>
                </li>
                <li>
                  <Link href="/resume" className="hover:text-gray-300">
                    Resume
                  </Link>
                </li>
                <li>
                  <Link href="/about" className=" hover:text-gray-300">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-white hover:text-gray-300">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/legal/privacy-policy" className="text-white hover:text-gray-300">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-gray-800 flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} • Made with 🩵 by Waseem Akram</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center hover:text-[#4ade80]/80 transition-colors"
            aria-label="Back to top"
          >
            <ArrowUp size={16} />
            <span className="mr-2">Back to top</span>
          </button>
        </div>
      </div>
    </footer>
  )
}