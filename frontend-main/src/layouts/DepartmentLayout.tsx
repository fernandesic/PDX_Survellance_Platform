import React from 'react';
import { Outlet } from 'react-router-dom';

const DepartmentLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50">
            <Outlet />
        </div>
    );
};

export default DepartmentLayout;
