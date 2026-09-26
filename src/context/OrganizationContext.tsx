import React, { createContext, useContext, useEffect, useState } from 'react';
import { Organization, OrganizationMember, MemberRole, OrgPendingApproval } from '../types';
import { dataStore } from '../lib/dataStore';

interface OrganizationContextType {
  activeOrg: Organization | undefined;
  currentOrg: Organization | undefined;
  organizations: Organization[];
  members: OrganizationMember[];
  pendingApprovals: OrgPendingApproval[];
  userRole: MemberRole;
  switchOrganization: (orgId: string) => void;
  acceptInviteToken: (token: string) => boolean;
  isOrgAdmin: boolean;
  refetchOrgData: () => void;
  reloadOrg: () => void;
}

const OrganizationContext = createContext<OrganizationContextType>({
  activeOrg: undefined,
  currentOrg: undefined,
  organizations: [],
  members: [],
  pendingApprovals: [],
  userRole: 'therapist',
  switchOrganization: () => {},
  acceptInviteToken: () => false,
  isOrgAdmin: false,
  refetchOrgData: () => {},
  reloadOrg: () => {},
});

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOrg, setActiveOrg] = useState<Organization | undefined>(dataStore.getActiveOrg());
  const [organizations, setOrganizations] = useState<Organization[]>(dataStore.getOrganizations() || []);
  const [members, setMembers] = useState<OrganizationMember[]>(dataStore.getOrganizationMembers() || []);
  const [pendingApprovals, setPendingApprovals] = useState<OrgPendingApproval[]>(dataStore.getPendingApprovals() || []);
  const [userRole, setUserRole] = useState<MemberRole>(dataStore.getUserRoleInOrg());

  const refresh = () => {
    const org = dataStore.getActiveOrg();
    setActiveOrg(org);
    setOrganizations(dataStore.getOrganizations() || []);
    setMembers(dataStore.getOrganizationMembers() || []);
    setPendingApprovals(dataStore.getPendingApprovals() || []);
    setUserRole(dataStore.getUserRoleInOrg());
  };

  useEffect(() => {
    refresh();
    const unsub = dataStore.subscribe(refresh);
    return unsub;
  }, []);

  const switchOrganization = (orgId: string) => {
    dataStore.setActiveOrgId(orgId);
    refresh();
  };

  const acceptInviteToken = (token: string) => {
    const res = dataStore.acceptInvite(token);
    if (res.ok) {
      refresh();
      return true;
    }
    return false;
  };

  const isOrgAdmin = userRole === 'owner' || userRole === 'admin';

  return (
    <OrganizationContext.Provider
      value={{
        activeOrg,
        currentOrg: activeOrg,
        organizations,
        members,
        pendingApprovals,
        userRole,
        switchOrganization,
        acceptInviteToken,
        isOrgAdmin,
        refetchOrgData: refresh,
        reloadOrg: refresh,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);

