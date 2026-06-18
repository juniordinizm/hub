"use client";

import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { JSX } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const notifications = [
  {
    id: "1",
    user: "Neuro Capacitar",
    avatar: "/protear/logo-negativo.png",
    initials: "NC",
    action: "adicionou um novo módulo em",
    target: "PROTEA-R",
    time: "2 min atrás",
    unread: true,
  },
  {
    id: "2",
    user: "Suporte",
    avatar: "",
    initials: "SU",
    action: "respondeu seu ticket de",
    target: "Dúvida sobre acesso",
    time: "1 hora atrás",
    unread: true,
  },
];

export function NotificationsButton(): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="relative" size="icon" variant="ghost">
          <HugeiconsIcon
            aria-hidden="true"
            icon={Notification01Icon}
            strokeWidth={2}
          />
          <Badge
            className="absolute -top-1 -right-1 size-5 justify-center rounded-full p-0"
            variant="destructive"
          >
            2
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificações</span>
            <button
              className="font-normal text-foreground text-xs underline-offset-2 hover:underline"
              type="button"
            >
              Marcar como lidas
            </button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {notifications.map((notification) => (
              <DropdownMenuItem
                className="flex items-start gap-2 py-2"
                key={notification.id}
              >
                <Avatar className="mt-0.5 size-8 shrink-0 bg-secondary p-1">
                  <AvatarImage
                    alt={notification.user}
                    className="object-contain"
                    src={notification.avatar}
                  />
                  <AvatarFallback className="text-xs">
                    {notification.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{notification.user}</span>{" "}
                    <span className="text-muted-foreground">
                      {notification.action}
                    </span>{" "}
                    <span className="font-medium">{notification.target}</span>
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {notification.time}
                  </span>
                </div>
                {notification.unread && (
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="justify-center text-center">
            Ver todas as notificações
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
