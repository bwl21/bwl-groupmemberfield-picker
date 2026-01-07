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
    try {
        const response = await churchtoolsClient.get(
            `/groups/${groupId}/memberfields`
        );
        
        console.log('Member fields raw response:', response);
        console.log('Response type:', typeof response);
        console.log('Is array?', Array.isArray(response));
        console.log('Has data?', response && 'data' in response);
        
        // Check if response has 'data' property (client didn't unpack)
        if (response && typeof response === 'object' && 'data' in response) {
            console.log('Unpacking data property');
            return (response as any).data as GroupMemberField[];
        }
        
        // Otherwise assume it's already unpacked
        if (Array.isArray(response)) {
            console.log('Response is already an array');
            return response as GroupMemberField[];
        }
        
        console.warn('Unexpected response format:', response);
        return [];
    } catch (error) {
        console.error('Error fetching member fields:', error);
        return [];
    }
}

/**
 * Get only group-specific member fields (not person fields)
 */
export async function getGroupSpecificMemberFields(
    groupId: number
): Promise<GroupMemberFieldGroup[]> {
    const fields = await getGroupMemberFields(groupId);
    
    console.log('All fields:', fields);
    console.log('Fields count:', fields.length);
    
    const groupFields = fields.filter((f) => {
        console.log('Field:', f, 'Type:', f.type);
        return f.type === 'group';
    });
    
    console.log('Group fields after filter:', groupFields);
    
    const result = groupFields.map((f) => f.field as GroupMemberFieldGroup);
    
    console.log('Final result:', result);
    
    return result;
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
 * Update custom fields on a group
 * Custom group fields are set directly on the group object, not in information
 */
export async function updateGroupCustomFields(
    groupId: number,
    fields: Record<string, any>
): Promise<void> {
    console.log('=== updateGroupCustomFields ===');
    console.log('Group ID:', groupId);
    console.log('Fields to update:', fields);
    
    console.log('Sending PATCH request...');
    
    // Custom group fields are set directly on the group, not in information
    const response = await churchtoolsClient.patch(`/groups/${groupId}`, fields);
    
    console.log('PATCH response:', response);
}

// Configuration field name
const CONFIG_FIELD_NAME = 'bwl_gmfp_config';

/**
 * Find the configuration field in a group
 * Looks for the specific field: bwl_gmfp_config in group.information
 * Returns the field even if it's empty (value will be undefined)
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
            
            // Check if the field exists (even if empty)
            if (CONFIG_FIELD_NAME in info) {
                const value = info[CONFIG_FIELD_NAME];
                const stringValue = typeof value === 'string' && value !== '' ? value : undefined;
                console.log(`✓ Found config field in information: ${CONFIG_FIELD_NAME} = ${stringValue || '(empty)'}`);
                
                // Return the field even if empty - this indicates the field exists in ChurchTools
                return {
                    fieldName: CONFIG_FIELD_NAME,
                    value: stringValue,
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
 * Create a new group member field in a group
 */
export async function createGroupMemberField(
    groupId: number,
    fieldDefinition: {
        name: string;
        fieldTypeCode: string;
        note?: string;
        defaultValue?: string;
        options?: Array<{ id: string; name: string }>;
        securityLevel?: string;
        useInRegistrationForm?: boolean;
        requiredInRegistrationForm?: boolean;
        sortKey?: number;
    }
): Promise<GroupMemberFieldGroup> {
    console.log('Creating field in group', groupId, ':', fieldDefinition);
    
    const response = await churchtoolsClient.post(
        `/groups/${groupId}/memberfields/group`,
        {
            useInRegistrationForm: fieldDefinition.useInRegistrationForm ?? false,
            requiredInRegistrationForm: fieldDefinition.requiredInRegistrationForm ?? false,
            securityLevel: fieldDefinition.securityLevel ?? '1',
            fieldTypeCode: fieldDefinition.fieldTypeCode,
            name: fieldDefinition.name,
            note: fieldDefinition.note ?? '',
            defaultValue: fieldDefinition.defaultValue ?? '',
            options: fieldDefinition.options ?? [],
            sortKey: fieldDefinition.sortKey ?? 1,
        }
    );
    
    console.log('Field created:', response);
    return response as GroupMemberFieldGroup;
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
