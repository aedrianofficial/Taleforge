import { supabase } from '@/src/config/supabase';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type User = {
  id: string;
  name: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
};

export default function AdminPanelScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ is_admin: !currentStatus })
      .eq('id', userId);

    if (error) {
      Alert.alert('Error', 'Failed to update user status');
    } else {
      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, is_admin: !currentStatus }
          : user
      ));
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('users')
              .delete()
              .eq('id', userId);

            if (error) {
              Alert.alert('Error', 'Failed to delete user');
            } else {
              setUsers(users.filter(u => u.id !== userId));
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={[styles.avatar, item.is_admin && styles.adminAvatar]}>
          <Text style={styles.avatarText}>
            {item.name[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email || 'Anonymous'}</Text>
          <Text style={styles.userDate}>Joined {formatDate(item.created_at)}</Text>
        </View>
      </View>

      <View style={styles.userActions}>
        <View style={styles.adminToggle}>
          <Text style={styles.adminToggleLabel}>Admin</Text>
          <Switch
            value={item.is_admin}
            onValueChange={() => toggleAdminStatus(item.id, item.is_admin)}
            trackColor={{ false: '#2C2C2E', true: '#C4A574' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteUser(item.id, item.name)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C4A574" />
      </View>
    );
  }

  const adminCount = users.filter(u => u.is_admin).length;
  const regularCount = users.filter(u => !u.is_admin).length;

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C4A574" />
        }
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>User Management</Text>
            <View style={styles.statsRow}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatNumber}>{users.length}</Text>
                <Text style={styles.miniStatLabel}>Total</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={[styles.miniStatNumber, styles.adminColor]}>{adminCount}</Text>
                <Text style={styles.miniStatLabel}>Admins</Text>
              </View>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatNumber}>{regularCount}</Text>
                <Text style={styles.miniStatLabel}>Users</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  listContent: {
    padding: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  miniStat: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  miniStatNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adminColor: {
    color: '#C4A574',
  },
  miniStatLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  userCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  adminAvatar: {
    backgroundColor: '#C4A574',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#6E6E73',
    marginTop: 2,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  adminToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminToggleLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

