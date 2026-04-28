import nodemailer from 'nodemailer';

// backend/controllers/familyController.js
import { db, auth } from '../config/firebase.js';
import { validateEmail, validatePhone } from '../utils/validation.js';

/**
 * Invite family member to access accounts
 * POST /api/family/invite
 */

const sendInviteEmail = async (toEmail, inviterName, role, invitationId) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  });
  await transporter.sendMail({
    from: `"UniPowerWallet" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `${inviterName} invited you to UniPowerWallet`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;">
        <h2 style="color:#2563eb;">⚡ UniPowerWallet Invitation</h2>
        <p>Hi there!</p>
        <p><strong>${inviterName}</strong> has invited you to manage electricity accounts on UniPowerWallet as a <strong>${role}</strong>.</p>
        <div style="background:#f0f9ff;padding:15px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;color:#1e40af;">Your invitation ID: <strong>${invitationId}</strong></p>
        </div>
        <p>To accept this invitation, sign up or log in at:</p>
        <a href="http://localhost:5173/signup" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Accept Invitation</a>
        <p style="color:#6b7280;font-size:12px;margin-top:20px;">This invitation expires in 7 days. If you did not expect this email, you can ignore it.</p>
      </div>
    `
  });
};

export const inviteFamilyMember = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { email, phone, name, role, accountIds } = req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({ 
        error: 'Email or phone number is required' 
      });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format' 
      });
    }

    const validRoles = ['Admin', 'Member', 'Viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be Admin, Member, or Viewer' 
      });
    }

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ 
        error: 'At least one account ID is required' 
      });
    }

    // Verify user owns all specified accounts
    for (const accountId of accountIds) {
      const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
      const account = accountSnapshot.val();
      
    if (accountId && account && account.userId !== userId) {
        return res.status(403).json({ 
          error: `You don't own account: ${accountId}` 
        });
      }
    }

    // Check if invitation already exists
    const existingInviteSnapshot = await db.ref('familyInvitations')
      .orderByChild('email')
      .equalTo(email)
      .once('value');

    const existingInvites = existingInviteSnapshot.val();
    if (existingInvites) {
      const activeInvite = Object.values(existingInvites).find(
        inv => inv.status === 'pending' && accountIds.some(id => inv.accountIds.includes(id))
      );
      
      if (activeInvite) {
        return res.status(400).json({ 
          error: 'An active invitation already exists for this user' 
        });
      }
    }

    // Create invitation
    const invitationId = db.ref('familyInvitations').push().key;
    const invitationData = {
      id: invitationId,
      invitedBy: userId,
      email: email || '',
      phone: phone || '',
      name: name || '',
      role,
      accountIds,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    await db.ref(`familyInvitations/${invitationId}`).set(invitationData);

    try {
      const inviterSnapshot = await db.ref(`users/${userId}`).once('value');
      const inviter = inviterSnapshot.val();
      await sendInviteEmail(email, inviter?.name || 'A UniPowerWallet user', role, invitationId);
      console.log('✅ Invitation email sent to:', email);
    } catch (emailErr) {
      console.log('⚠️ Email send failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Family member invited successfully',
      invitation: invitationData
    });

  } catch (error) {
    console.error('Invite family member error:', error);
    res.status(500).json({ 
      error: 'Failed to invite family member',
      details: error.message 
    });
  }
};

/**
 * Accept family invitation
 * POST /api/family/accept-invitation/:invitationId
 */
export const acceptInvitation = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { invitationId } = req.params;

    // Get invitation
    const invitationSnapshot = await db.ref(`familyInvitations/${invitationId}`).once('value');
    const invitation = invitationSnapshot.val();

    if (!invitation) {
      return res.status(404).json({ 
        error: 'Invitation not found' 
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Invitation has already been processed' 
      });
    }

    // Check expiration
    if (new Date(invitation.expiresAt) < new Date()) {
      await db.ref(`familyInvitations/${invitationId}`).update({ 
        status: 'expired' 
      });
      return res.status(400).json({ 
        error: 'Invitation has expired' 
      });
    }

    // Get user info
    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    const user = userSnapshot.val();

    // Verify email/phone matches
    if (invitation.email && user.email !== invitation.email) {
      return res.status(403).json({ 
        error: 'This invitation is for a different email address' 
      });
    }

    // Create family member entries for each account
    for (const accountId of invitation.accountIds) {
      const memberId = db.ref('familyMembers').push().key;
      const memberData = {
        id: memberId,
        accountId,
        userId,
        email: user.email,
        name: user.name || invitation.name,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date().toISOString()
      };

      await db.ref(`familyMembers/${memberId}`).set(memberData);
    }

    // Update invitation status
    await db.ref(`familyInvitations/${invitationId}`).update({
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      acceptedBy: userId
    });

    res.json({
      message: 'Invitation accepted successfully',
      accountsAccess: invitation.accountIds.length,
      role: invitation.role
    });

  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ 
      error: 'Failed to accept invitation',
      details: error.message 
    });
  }
};

/**
 * Get family members for an account
 * GET /api/family/members/:accountId
 */
export const getFamilyMembers = async (req, res) => {
  // This function now also pulls accepted invitations as members
  try {
    const userId = req.user.uid;
    const { accountId } = req.params;

    // Check if user has access to this account (as owner or member)
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    const isOwner = account && account.userId === userId;

    if (!isOwner) {
      // Check if user is a family member
      const memberSnapshot = await db.ref('familyMembers')
        .orderByChild('accountId')
        .equalTo(accountId)
        .once('value');

      const members = memberSnapshot.val();
      const isMember = members && Object.values(members).some(m => m.userId === userId);

      if (!isMember) {
        return res.status(403).json({ 
          error: 'Unauthorized access to this account' 
        });
      }
    }

    // Get all family members for this account
    const membersSnapshot = await db.ref('familyMembers')
      .orderByChild('accountId')
      .equalTo(accountId)
      .once('value');

    const membersData = membersSnapshot.val();
    const members = membersData ? Object.values(membersData) : [];

    // Also pull accepted invitations as members
    const invSnapshot = await db.ref('familyInvitations').orderByChild('status').equalTo('accepted').once('value');
    const invData = invSnapshot.val();
    if (invData) {
      for (const inv of Object.values(invData)) {
        if (inv.accountIds && inv.accountIds.includes(accountId)) {
          const alreadyAdded = members.some(m => m.email === inv.email);
          if (!alreadyAdded) {
            const userSnap = await db.ref('users').orderByChild('email').equalTo(inv.email).once('value');
            const userData = userSnap.val();
            const user = userData ? Object.values(userData)[0] : null;
            members.push({
              id: inv.id,
              accountId,
              userId: inv.acceptedBy || '',
              email: inv.email,
              name: user?.name || inv.email,
              role: inv.role,
              status: 'accepted',
              joinedAt: inv.acceptedAt || inv.createdAt
            });
          }
        }
      }
    }

    // Add account owner as "Owner" role
    if (account) {
      const ownerSnapshot = await db.ref(`users/${account.userId}`).once('value');
      const owner = ownerSnapshot.val();

      members.unshift({
        id: 'owner',
        accountId,
        userId: account.userId,
        email: owner?.email || '',
        name: owner?.name || 'Account Owner',
        role: 'Owner',
        joinedAt: account.createdAt
      });
    }

    res.json({
      message: 'Family members retrieved successfully',
      members,
      count: members.length
    });

  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve family members' 
    });
  }
};

/**
 * Remove family member from account
 * DELETE /api/family/members/:memberId
 */
export const removeFamilyMember = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { memberId } = req.params;

    // Get member details - check both familyMembers and familyInvitations
    let memberSnapshot = await db.ref(`familyMembers/${memberId}`).once('value');
    let member = memberSnapshot.val();
    let isInvitation = false;

    if (!member) {
      // Check familyInvitations
      const invSnapshot = await db.ref(`familyInvitations/${memberId}`).once('value');
      member = invSnapshot.val();
      isInvitation = true;
    }

    if (!member) {
      return res.status(404).json({ 
        error: 'Family member not found' 
      });
    }

    // Verify user is the account owner
    const accountId = member.accountId || (member.accountIds && member.accountIds[0]);
    const accountSnapshot = await db.ref(`accounts/${accountId}`).once('value');
    const account = accountSnapshot.val();

    if (acctId && account && account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Only account owner can remove family members' 
      });
    }

    // Remove member
    await db.ref(`familyMembers/${memberId}`).remove();

    res.json({
      message: 'Family member removed successfully',
      memberId
    });

  } catch (error) {
    console.error('Remove family member error:', error);
    res.status(500).json({ 
      error: 'Failed to remove family member' 
    });
  }
};

/**
 * Update family member role
 * PUT /api/family/members/:memberId/role
 */
export const updateMemberRole = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { memberId } = req.params;
    const { role } = req.body;

    const validRoles = ['Admin', 'Member', 'Viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be Admin, Member, or Viewer' 
      });
    }

    // Get member details - check both familyMembers and familyInvitations
    let memberSnapshot = await db.ref(`familyMembers/${memberId}`).once('value');
    let member = memberSnapshot.val();
    let isInvitation = false;

    if (!member) {
      // Check familyInvitations
      const invSnapshot = await db.ref(`familyInvitations/${memberId}`).once('value');
      member = invSnapshot.val();
      isInvitation = true;
    }

    if (!member) {
      return res.status(404).json({ 
        error: 'Family member not found' 
      });
    }

    // Verify user is the account owner
    const acctId = member.accountId || (member.accountIds && member.accountIds[0]);
    const accountSnapshot = await db.ref(`accounts/${acctId}`).once('value');
    const account = accountSnapshot.val();

    if (acctId && account && account.userId !== userId) {
      return res.status(403).json({ 
        error: 'Only account owner can update member roles' 
      });
    }

    // Update role
    // Update in correct collection
    const updateRef = isInvitation ? `familyInvitations/${memberId}` : `familyMembers/${memberId}`;
    await db.ref(updateRef).update({
      role,
      updatedAt: new Date().toISOString()
    });

    res.json({
      message: 'Member role updated successfully',
      memberId,
      newRole: role
    });

  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ 
      error: 'Failed to update member role' 
    });
  }
};

/**
 * Get pending invitations sent by user
 * GET /api/family/invitations
 */
export const getMyInvitations = async (req, res) => {
  try {
    const userId = req.user.uid;

    const invitationsSnapshot = await db.ref('familyInvitations')
      .orderByChild('invitedBy')
      .equalTo(userId)
      .once('value');

    const invitationsData = invitationsSnapshot.val();
    const invitations = invitationsData ? Object.values(invitationsData) : [];

    // Sort by date descending
    invitations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      message: 'Invitations retrieved successfully',
      invitations,
      count: invitations.length
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve invitations' 
    });
  }
};
