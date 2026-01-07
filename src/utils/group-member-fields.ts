import { churchtoolsClient } from '@churchtools/churchtools-client';
import type {
    Group,
    GroupMemberField,
    GroupMemberFieldGroup,
} from './ct-types';

/**
 * Get all member fields for a group
 */
export async function getGroupMemberFields(
    groupId: number
): Promise<GroupMemberField[]> {
    const response = await churchtoolsClient.get<{ data: GroupMemberField[] }>(
        `/groups/${groupId}/memberfields`
    );
    return response.data;
}

/**
 * Get only group-specific member fields (not person fields)
 */
export async function getGroupSpecificMemberFields(
    groupId: number
): Promise<GroupMemberFieldGroup[]> {
    const fields = await getGroupMemberFields(groupId);
    return fields
        .filter((f) => f.type === 'group')
        .map((f) => f.field as GroupMemberFieldGroup);
}



/**
 * Get group details including custom group fields
 */
export async function getGroup(groupId: number): Promise<Group> {
    const response = await churchtoolsClient.get<{ data: Group }>(
        `/groups/${groupId}`
    );
    return response.data;
}

/**
 * Get a specific custom field value from a group
 */
export async function getGroupCustomField<T = string>(
    groupId: number,
    fieldName: string
): Promise<T | undefined> {
    const group = await getGroup(groupId);
    const value = (group as any)[fieldName];
    return value as T | undefined;
}

/**
 * Update custom fields on a group
 */
export async function updateGroupCustomFields(
    groupId: number,
    fields: Record<string, any>
): Promise<void> {
    await churchtoolsClient.patch(`/groups/${groupId}`, fields);
}

/**
 * Find the configuration field in a group by name pattern
 * Looks for fields containing "config" or "konfiguration" (case-insensitive)
 */
export async function findConfigurationField(
    groupId: number
): Promise<{ fieldName: string; value: string | undefined } | undefined> {
    const group = await getGroup(groupId);
    
    // Search for field names containing "config" or "konfiguration"
    const configPattern = /(config|konfiguration)/i;
    
    for (const [key, value] of Object.entries(group)) {
        if (configPattern.test(key) && typeof value === 'string') {
            return {
                fieldName: key,
                value: value || undefined,
            };
        }
    }
    
    return undefined;
}

/**
 * Example usage:
 * 
 * // Get group with custom fields
 * const group = await getGroup(100);
 * console.log(group.field_mapping_config);
 * 
 * // Get specific custom field
 * const config = await getGroupCustomField(100, 'field_mapping_config');
 * console.log(config);
 * 
 * // Update custom field
 * await updateGroupCustomFields(100, {
 *   field_mapping_config: JSON.stringify({ version: "1.0", ... })
 * });
 * 
 * // Find configuration field automatically
 * const configField = await findConfigurationField(100);
 * if (configField) {
 *   console.log(`Found config in field: ${configField.fieldName}`);
 *   const config = JSON.parse(configField.value || '{}');
 * }
 * 
 * // Get all member fields for a group
 * const fields = await getGroupMemberFields(2172);
 * console.log(fields);
 * 
 * // Get only group-specific member fields
 * const groupFields = await getGroupSpecificMemberFields(2172);
 * console.log(groupFields);
 */
