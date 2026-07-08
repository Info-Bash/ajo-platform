import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'TESTING'];
const VISIBILITIES = ['PUBLIC', 'PRIVATE'];
const ACTIVATION_MODES = ['AUTO_START_WHEN_FULL', 'MANUAL_START_BY_ADMIN'];

export class CreateGroupDto {
  @ApiProperty({ example: 'Lagos Hustlers Circle' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'Weekly contribution circle for the Lagos crew' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 10000,
    description:
      "Each member's contribution per round, in **Naira**. The total payout " +
      'pot (contributionAmountKobo) is derived as memberShareAmount × cycleLength.',
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Minimum member contribution is ₦100' })
  memberShareAmount: number;

  @ApiProperty({
    example: 6,
    description:
      'Target number of members = number of rounds in the rotation. ' +
      'Group activates once this many members have joined (or earlier, if ' +
      'the admin manually starts it).',
    minimum: 2,
    maximum: 50,
  })
  @IsInt()
  @Min(2, { message: 'A group needs at least 2 members' })
  @Max(50, { message: 'A group cannot have more than 50 members' })
  cycleLength: number;

  @ApiProperty({
    enum: FREQUENCIES,
    example: 'WEEKLY',
    description:
      'How often each round runs. `TESTING` (3-minute rounds) is only ' +
      'available outside production, for exercising the contribution flow quickly.',
  })
  @IsIn(FREQUENCIES)
  frequency: string;

  @ApiProperty({
    enum: VISIBILITIES,
    example: 'PRIVATE',
    description:
      'PUBLIC groups are discoverable on the public page and joined via ' +
      'request + admin approval. PRIVATE groups are only joinable via invite link.',
  })
  @IsIn(VISIBILITIES)
  visibility: string;

  @ApiProperty({
    enum: ACTIVATION_MODES,
    example: 'MANUAL_START_BY_ADMIN',
    description:
      'AUTO_START_WHEN_FULL activates the instant the group fills up. ' +
      'MANUAL_START_BY_ADMIN waits for the admin to explicitly start it ' +
      '(useful when the organizer wants to vet members first).',
  })
  @IsIn(ACTIVATION_MODES)
  activationMode: string;

  @ApiPropertyOptional({
    example: 48,
    description: 'Hours before a LATE contribution flips to DEFAULTED. Defaults to 48.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  gracePeriodHours?: number;
}

export class RequestToJoinDto {
  @ApiPropertyOptional({
    example: "I'm a market trader in the same area, would love to join!",
    description: 'Optional note shown to the admin reviewing the request.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  message?: string;
}

export class ReviewJoinRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'], example: 'APPROVE' })
  @IsIn(['APPROVE', 'REJECT'])
  decision: 'APPROVE' | 'REJECT';
}

export class ListPublicGroupsDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class InviteUserDto {
  @ApiProperty({
    example: '2025001234',
    description: "The invited user's wallet account number (easiest to share/verify).",
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;
}
