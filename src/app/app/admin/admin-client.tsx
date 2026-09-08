"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { updateMemberRole, updateMemberStatus } from "@/server/actions/admin";

export interface MemberRow {
  id: string;
  role: string;
  status: string;
  createdAt: Date;
  user: { name: string; email: string };
}

export function MembersTable({
  members,
  currentMembershipId,
}: {
  members: MemberRow[];
  currentMembershipId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(memberId: string, role: Role) {
    startTransition(async () => {
      const result = await updateMemberRole(memberId, role);
      if (result.success) {
        toast.success("Papel do usuário atualizado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleStatusToggle(memberId: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    startTransition(async () => {
      const result = await updateMemberStatus(memberId, nextStatus);
      if (result.success) {
        toast.success(nextStatus === "active" ? "Usuário reativado." : "Usuário suspenso.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Desde</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const isSelf = member.id === currentMembershipId;
          return (
            <TableRow key={member.id}>
              <TableCell>{member.user.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{member.user.email}</TableCell>
              <TableCell>
                <Select
                  value={member.role}
                  onValueChange={(value) => handleRoleChange(member.id, value as Role)}
                  disabled={isSelf || isPending}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={member.status === "active"}
                    disabled={isSelf || isPending}
                    onCheckedChange={() => handleStatusToggle(member.id, member.status)}
                  />
                  <Badge variant={member.status === "active" ? "success" : "neutral"}>
                    {member.status === "active" ? "Ativo" : "Suspenso"}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(member.createdAt, "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
