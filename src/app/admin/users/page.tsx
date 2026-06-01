"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { api, type ManagedUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, ShieldOff, ShieldCheck } from "lucide-react";
import { fmtTime, toUTCDate } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  user: "Usuario",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  superadmin: "default",
  admin: "secondary",
  user: "outline",
};

function fmtDate(utc: string) {
  return fmtTime(utc).split(" ")[0]; // just dd/MM
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newRole, setNewRole] = React.useState("user");
  const [creating, setCreating] = React.useState(false);

  // Edit dialog
  const [editUser, setEditUser] = React.useState<ManagedUser | null>(null);
  const [editRole, setEditRole] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [editing, setEditing] = React.useState(false);

  // Delete confirm
  const [deleteUser, setDeleteUser] = React.useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      setUsers(await api.listUsers());
    } catch {
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser(newUsername.trim(), newPassword, newRole);
      setCreateOpen(false);
      setNewUsername(""); setNewPassword(""); setNewRole("user");
      await loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditing(true);
    try {
      const patch: { role?: string; password?: string } = {};
      if (editRole && editRole !== editUser.role) patch.role = editRole;
      if (editPassword.trim()) patch.password = editPassword;
      if (Object.keys(patch).length) await api.updateUser(editUser.username, patch);
      setEditUser(null); setEditPassword("");
      await loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al editar usuario");
    } finally {
      setEditing(false);
    }
  }

  async function handleToggleActive(user: ManagedUser) {
    try {
      await api.updateUser(user.username, { active: !user.active });
      await loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await api.deleteUser(deleteUser.username);
      setDeleteUser(null);
      await loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell title="Gestión de usuarios">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Gestioná cuentas, roles y accesos al sistema.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Nuevo usuario
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden sm:table-cell">Creado</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-24 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-5 w-16 animate-pulse rounded-full bg-muted" /></TableCell>
                    <TableCell><div className="h-5 w-16 animate-pulse rounded-full bg-muted" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : users.map((u) => (
                <TableRow key={u.id} className={!u.active ? "opacity-50" : undefined}>
                  <TableCell className="font-mono text-sm font-medium">{u.username}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANTS[u.role] ?? "outline"}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "outline" : "secondary"} className={u.active ? "text-risk-low border-risk-low/30" : ""}>
                      {u.active ? "Activo" : "Desactivado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {fmtDate(u.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={u.active ? "Desactivar" : "Activar"}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.active
                          ? <ShieldOff className="size-4 text-muted-foreground" />
                          : <ShieldCheck className="size-4 text-risk-low" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar"
                        onClick={() => { setEditUser(u); setEditRole(u.role); setEditPassword(""); }}
                      >
                        <Pencil className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar"
                        onClick={() => setDeleteUser(u)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {loading ? "Cargando..." : `${users.length} usuario${users.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creando..." : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar — {editUser?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nueva contraseña <span className="text-muted-foreground">(dejar vacío para no cambiar)</span></Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={editing}>{editing ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            ¿Seguro que querés eliminar a <span className="font-mono font-medium text-foreground">{deleteUser?.username}</span>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
