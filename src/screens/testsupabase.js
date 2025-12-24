import React, { useEffect, useState } from 'react';
import { Button, FlatList, Text, TextInput, View } from 'react-native';
import { supabase } from '../config/supabase';

const TestSupabaseScreen = () => {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');

  // Fetch posts from Supabase
  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Error fetching posts:', error);
    } else {
      setPosts(data);
    }
  };

  // Add a new post
  const addPost = async () => {
    if (!text) return;
    const { data, error } = await supabase.from('posts').insert([
      {
        text,
        user_id: '00000000-0000-0000-0000-000000000000', // placeholder user ID
      },
    ]);

    if (error) {
      console.log('Error adding post:', error);
    } else {
      console.log('Post added:', data);
      setText('');
      fetchPosts(); // refresh list
    }
  };

  // Fetch posts on mount
  useEffect(() => {
    fetchPosts();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Supabase Test Screen</Text>

      <TextInput
        placeholder="Enter post text"
        value={text}
        onChangeText={setText}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginVertical: 10,
        }}
      />

      <Button title="Add Post" onPress={addPost} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              borderBottomWidth: 1,
              borderColor: '#eee',
              paddingVertical: 10,
            }}
          >
            <Text>{item.text}</Text>
          </View>
        )}
      />
    </View>
  );
};

export default TestSupabaseScreen;
