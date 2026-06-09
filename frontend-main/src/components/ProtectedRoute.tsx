import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';
import { Loading } from './Loading';

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const { user, isAuthChecking } = useAuth();

    if (isAuthChecking) {
        return <Loading />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
        // Redirect logic based on current role if they don't have access
        if (user.role === 'supplier') {
            return <Navigate to="/supplier/admin" replace />;
        }
        if (user.role === 'department') {
            return <Navigate to="/department/admin" replace />;
        }
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
