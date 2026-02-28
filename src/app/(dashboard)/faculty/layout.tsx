export default function FacultyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // NOTE: The parent (dashboard)/layout.tsx already renders the role-aware sidebar.
    // This layout is intentionally minimal to avoid a double-sidebar.
    return <>{children}</>;
}
