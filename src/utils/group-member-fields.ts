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
    const response = await churchtoolsClient.get<Group>(
        `/groups/${groupId}`
    );
    return response;
}

/**
 * Get a specific custom field value from a group (looks in group.information)
 */
export async function getGroupCustomField<T = string>(
    groupId: number,
    fieldName: string
): Promise<T | undefined> {
    const group = await getGroup(groupId);
    if (group.information && typeof group.information === 'object') {
        const value = (group.information as any)[fieldName];
        return value as T | undefined;
    }
    return undefined;
}

/**
 * Update custom fields on a group (updates group.information)
 */
export async function updateGroupCustomFields(
    groupId: number,
    fields: Record<string, any>
): Promise<void> {
    await churchtoolsClient.patch(`/groups/${groupId}`, {
        information: fields,
    });
}

// Configuration field name
const CONFIG_FIELD_NAME = 'bwl_gmfp_config';

/**
 * Find the configuration field in a group
 * Looks for the specific field: bwl_gmfp_config in group.information
 */
export async function findConfigurationField(
    groupId: number
): Promise<{ fieldName: string; value: string | undefined } | undefined> {
    try {
        const group = await getGroup(groupId);
        
        console.log('Group data:', group);
        console.log('Group.information:', group.information);
        
        if (!group || typeof group !== 'object') {
            console.error('Invalid group data:', group);
            return undefined;
        }
        
        // Check if the config field exists in group.information
        if (group.information && typeof group.information === 'object') {
            const info = group.information as any;
            
            if (CONFIG_FIELD_NAME in info) {
                const value = info[CONFIG_FIELD_NAME];
                console.log(`✓ Found config field in information: ${CONFIG_FIELD_NAME} = ${value}`);
                return {
                    fieldName: CONFIG_FIELD_NAME,
                    value: typeof value === 'string' ? value : undefined,
                };
            }
        }
        
        console.log(`Config field '${CONFIG_FIELD_NAME}' not found in group.information`);
        return undefined;
    } catch (error) {
        console.error('Error in findConfigurationField:', error);
        throw error;
    }
}

/**
 * Get the configuration field name
 */
export function getConfigFieldName(): string {
    return CONFIG_FIELD_NAME;
}

/**
 * Example usage:
 * 
 * // Get group with custom fields
 * const group = await getGroup(100);
 * console.log(group.information.bwl_gmfp_config);
 * 
 * // Get specific custom field
 * const config = await getGroupCustomField(100, 'bwl_gmfp_config');
 * console.log(config);
 * 
 * // Update custom field
 * await updateGroupCustomFields(100, {
 *   bwl_gmfp_config: JSON.stringify({ version: "1.0", ... })
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
