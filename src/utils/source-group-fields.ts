import type { GroupMemberFieldGroup } from './ct-types';

export interface SourceGroupFields {
    id: number;
    name: string;
    fields: GroupMemberFieldGroup[];
    error?: string;
}
