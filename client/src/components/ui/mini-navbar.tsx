"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { Video, Settings, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBrand } from '@/contexts/BrandContext';

interface UserData {
  id: string;
  email: string;
  isAdmin: boolean;
}

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

  // Get dynamic app name from brand context (admin-configurable)
  const { appName } = useBrand();

  // Fetch user data to check admin status
  const { data: userData } = useQuery<UserData>({
    queryKey: ['/api/user'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isAdmin = userData?.isAdmin ?? false;

  const toggleMenu = () => {
    setIsOpen(!isOpen);
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
        <span className="text-white font-semibold text-sm">{appName}</span>
      </a>
    </Link>
  );

  const navLinksData = [
    { label: 'Clips', href: '/videos' },
    { label: 'Ads', href: '/ai-studio' },
    { label: 'Engine', href: '/content-engine' },
    { label: 'Analytics', href: '/schedule' },
    { label: 'Socials', href: '/socials' },
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
          {isAdmin && (
            <Link href="/admin/credits">
              <a className="relative inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 cursor-pointer transition-colors duration-200 ease-out hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </a>
            </Link>
          )}
          <Link href="/settings/billing">
            <a className="relative inline-flex items-center text-white/90 hover:text-white cursor-pointer transition-colors duration-200 ease-out hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
              <Settings className="h-5 w-5" />
            </a>
          </Link>
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
          {isAdmin && (
            <Link href="/admin/credits">
              <a className="inline-flex items-center justify-center gap-2 text-base text-amber-400 hover:text-amber-300 transition-colors duration-200 w-full text-center cursor-pointer hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                <Shield className="h-4 w-4" />
                <span>Admin</span>
              </a>
            </Link>
          )}
          <Link href="/settings/billing">
            <a className="inline-flex items-center justify-center gap-2 text-base text-white/90 hover:text-white transition-colors duration-200 w-full text-center cursor-pointer hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </a>
          </Link>
        </nav>
      </div>
    </header>
  );
}
