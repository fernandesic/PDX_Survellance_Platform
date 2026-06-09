import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { Loading } from './Loading';

/**
 * Protects /supplier/admin routes.
 * - Not logged in → redirect to /login
 * - Logged in but role is NOT "supplier" → redirect to /
 * - Logged in with role "supplier" → render child routes
 */
const SupplierProtectedRoute: React.FC = () => {
    const { user, isAuthChecking } = useAuth();

    if (isAuthChecking) {
        return <Loading />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'supplier') {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default SupplierProtectedRoute;
