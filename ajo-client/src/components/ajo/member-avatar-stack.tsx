import * as React from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"

export interface AjoMember {
  id: string
  name: string
  avatarUrl?: string
}

interface MemberAvatarStackProps extends React.ComponentProps<"div"> {
  members: AjoMember[]
  /** How many avatars to show before collapsing into a "+N" count */
  max?: number
  size?: "default" | "sm" | "lg"
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

function MemberAvatarStack({
  members,
  max = 4,
  size = "default",
  className,
  ...props
}: MemberAvatarStackProps) {
  const visible = members.slice(0, max)
  const overflow = members.length - visible.length

  return (
    <AvatarGroup data-size={size} className={className} {...props}>
      {visible.map((member) => (
        <Avatar key={member.id} size={size} title={member.name}>
          {member.avatarUrl && (
            <AvatarImage src={member.avatarUrl} alt={member.name} />
          )}
          <AvatarFallback>{initials(member.name)}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <AvatarGroupCount title={`${overflow} more member${overflow === 1 ? "" : "s"}`}>
          +{overflow}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  )
}

export { MemberAvatarStack }