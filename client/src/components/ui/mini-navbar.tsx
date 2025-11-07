"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { Video, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <Link href={href}>
      <a className="relative inline-flex items-center text-sm text-white/90 hover:text-white cursor-pointer transition-colors duration-200 ease-out hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
        <span>{children}</span>
      </a>
    </Link>
  );
};

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
  const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { signOut } = useAuth();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    if (shapeTimeoutRef.current) {
      clearTimeout(shapeTimeoutRef.current);
    }

    if (isOpen) {
      setHeaderShapeClass('rounded-xl');
    } else {
      shapeTimeoutRef.current = setTimeout(() => {
        setHeaderShapeClass('rounded-full');
      }, 300);
    }

    return () => {
      if (shapeTimeoutRef.current) {
        clearTimeout(shapeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const logoElement = (
    <Link href="/">
      <a className="flex items-center space-x-2 cursor-pointer">
        <Video className="h-5 w-5 text-gray-200" />
        <span className="text-white font-semibold text-sm">Streamline</span>
      </a>
    </Link>
  );

  const navLinksData = [
    { label: 'My Videos', href: '/videos' },
    { label: 'AI Studio', href: '/ai-studio' },
    { label: 'Socials', href: '/socials' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Settings', href: '/settings/billing' },
  ];

  return (
    <header className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100]
                       flex flex-col items-center
                       pl-6 pr-6 py-3 backdrop-blur-sm
                       ${headerShapeClass}
                       border border-[#333] bg-[#1f1f1f57]
                       w-[calc(100%-2rem)] sm:w-auto
                       transition-[border-radius] duration-0 ease-in-out`}>

      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        <div className="flex items-center">
           {logoElement}
        </div>

        <nav className="hidden sm:flex items-center space-x-4 sm:space-x-6 text-sm">
          {navLinksData.map((link) => (
            <AnimatedNavLink key={link.href} href={link.href}>
              {link.label}
            </AnimatedNavLink>
          ))}
          <button
            onClick={handleLogout}
            className="relative inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white cursor-pointer transition-colors duration-200 ease-out hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </nav>

        <button className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300 focus:outline-none" onClick={toggleMenu} aria-label={isOpen ? 'Close Menu' : 'Open Menu'}>
          {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          )}
        </button>
      </div>

      <div className={`sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden
                       ${isOpen ? 'max-h-[1000px] opacity-100 pt-4' : 'max-h-0 opacity-0 pt-0 pointer-events-none'}`}>
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinksData.map((link) => (
            <Link key={link.href} href={link.href}>
              <a className="text-white/90 hover:text-white transition-colors duration-200 w-full text-center cursor-pointer hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                {link.label}
              </a>
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 text-base text-white/90 hover:text-white transition-colors duration-200 w-full text-center cursor-pointer hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
