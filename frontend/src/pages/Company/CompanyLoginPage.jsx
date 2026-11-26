import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomePage from '../HomePage';
import CompanyLoginModal from '../../components/auth/CompanyLoginModal';

export default function CompanyLoginPage() {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleClose = () => {
    // 1. Immediately hide modal state in React DOM
    setIsOpen(false);

    // 2. Safely navigate away to Home page or prior public route
    const fromPath = location.state?.from?.pathname || location.state?.from;
    if (fromPath && typeof fromPath === 'string' && !fromPath.startsWith('/company') && !fromPath.startsWith('/login')) {
      navigate(fromPath, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <>
      <HomePage />
      <CompanyLoginModal
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
}
