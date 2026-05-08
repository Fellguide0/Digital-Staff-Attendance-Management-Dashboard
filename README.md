# Digital-Staff-Attendance-Management-Dashboard
A secure, role-based digital attendance system for educational institutions. Features a time-validated QR kiosk, real-time admin dashboard, and automated Excel reporting.
#  Digital Staff Attendance Management System

##  Overview
A comprehensive web application engineered to modernize staff attendance tracking for educational institutions. Built to replace manual logbooks, this system provides a highly secure, frictionless check-in experience for teachers and a powerful real-time analytics dashboard for school administrators.

##  Key Features
*   **Secure QR-Code Kiosk:** Implemented a dynamic QR code generator with cryptographic time-based validation (30-second expiration window) to prevent bypasses and remote check-ins.
*   **Role-Based Access Control (RBAC):** Secure routing and UI rendering based on user roles (Admin/Director vs. Teacher), powered by Clerk.
*   **Real-Time Admin Dashboard:** Live metrics tracking daily attendance, late arrivals, and absences.
*   **Automated Reporting:** Instant generation and downloading of customizable Excel reports based on historical attendance data.
*   **Advanced Security:** Included automated idle session timeouts for administrative data protection.
*   **Staff Management (CRUD):** Complete interface for administrators to register, edit, and manage active/inactive personnel.

##  Tech Stack
*   **Frontend:** Astro, HTML/CSS (Custom responsive UI)
*   **Backend / API:** Astro API Routes (Server-Side Rendering)
*   **Database:** Supabase (PostgreSQL with custom RPC functions)
*   **Authentication:** Clerk (OAuth, Magic Links, and Session Management)
*   **Deployment:** Vercel
