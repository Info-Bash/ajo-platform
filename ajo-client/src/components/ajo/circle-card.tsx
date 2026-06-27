"use client"

import * as React from "react"
import { Calendar, Users } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MemberAvatarStack, type AjoMember } from "@/components/ajo/member-avatar-stack"
import { StatusBadge, type AjoStatus } from "@/components/ajo/status-badge"

export interface AjoCircle {
  id: string
  name: string
  /** e.g. "₦20,000 / week" */
  contributionSummary: string
  members: AjoMember[]
  /** Status of the current user within this circle */
  myStatus: AjoStatus
  /** e.g. "Due in 3 days" or "Next payout: Jan 12" */
  scheduleNote: string
  /** 0-100, how far through the full rotation this circle is */
  progressPercent: number
}

interface CircleCardProps extends React.ComponentProps<"div"> {
  circle: AjoCircle
  onClick?: () => void
}

function CircleCard({ circle, onClick, className, ...props }: CircleCardProps) {
  const {
    name,
    contributionSummary,
    members,
    myStatus,
    scheduleNote,
    progressPercent,
  } = circle

  return (
    <Card
      data-slot="circle-card"
      onClick={onClick}
      className={`${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""} ${className ?? ""}`}
      {...props}
    >
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{contributionSummary}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <MemberAvatarStack members={members} max={5} size="sm" />
          <StatusBadge status={myStatus} />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>{scheduleNote}</span>
        </div>

        {/* Rotation progress */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {members.length} members
            </span>
            <span>{progressPercent}% complete</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <span className="text-xs font-medium text-primary">View circle &rarr;</span>
      </CardFooter>
    </Card>
  )
}

export { CircleCard }