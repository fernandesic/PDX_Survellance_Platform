"""
Custom permission classes for role-based access control.
"""
from rest_framework.permissions import BasePermission


class IsNotUserRole(BasePermission):
    """
    Permission class that denies access to users with the 'user' role.
    Only allows access to users with 'super_admin' or 'admin' roles.
    """
    message = "Access denied. This feature is not available for your role."

    def has_permission(self, request, view):
        # First check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers bypass role checks
        if request.user.is_superuser:
            return True
        
        # Check if user has a role and it's not 'user'
        user = request.user
        if hasattr(user, 'role') and user.role:
            # Allow only super_admin and admin roles
            return user.role.name in ['super_admin', 'admin']
        
        # If no role is assigned, deny access
        return False


class IsAdminOrSuperAdmin(BasePermission):
    """
    Permission class that only allows super_admin or admin roles.
    """
    message = "Access denied. Admin privileges required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
            
        user = request.user
        if hasattr(user, 'role') and user.role:
            return user.role.name in ['super_admin', 'admin']
        
        return False


class IsSupplierOrAdmin(BasePermission):
    """
    Permission class that allows access to 'supplier', 'admin', and 'super_admin' roles.
    """
    message = "Access denied. Supplier or Admin privileges required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
            
        user = request.user
        if hasattr(user, 'role') and user.role:
            return user.role.name in ['super_admin', 'admin', 'supplier']
        
        return False


class IsDepartmentOrAdmin(BasePermission):
    """
    Permission class that allows access to 'department', 'admin', and 'super_admin' roles.
    """
    message = "Access denied. Department or Admin privileges required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
            
        user = request.user
        if hasattr(user, 'role') and user.role:
            return user.role.name in ['super_admin', 'admin', 'department']
        
        return False


class IsSuperAdmin(BasePermission):
    """
    Permission class that only allows super_admin role.
    """
    message = "Access denied. Super admin privileges required."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
            
        user = request.user
        if hasattr(user, 'role') and user.role:
            return user.role.name == 'super_admin'
        
        return False


class IsNotSupplierRole(BasePermission):
    """
    Permission class that denies access to users with the 'supplier' role.
    Allows access to 'user', 'admin', and 'super_admin'.
    """
    message = "Access denied. Current role cannot access core data dashboards."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        if request.user.is_superuser:
            return True

        user = request.user
        if hasattr(user, 'role') and user.role:
            return user.role.name != 'supplier'
            
        return False
