import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { Loading } from './Loading';

const DepartmentProtectedRoute: React.FC = () => {
    const { user, isAuthChecking } = useAuth();

    if (isAuthChecking) {
        return <Loading />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'department') {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default DepartmentProtectedRoute;
