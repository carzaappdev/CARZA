export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id?: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_participants: {
        Row: {
          archived_at: string | null;
          conversation_id: string;
          last_emailed_at: string | null;
          last_read_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          conversation_id: string;
          last_emailed_at?: string | null;
          last_read_at?: string | null;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          conversation_id?: string;
          last_emailed_at?: string | null;
          last_read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string | null;
          dealership_id: string | null;
          dealership_last_read_at: string | null;
          id: string;
          last_message_at: string;
          listing_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dealership_id?: string | null;
          dealership_last_read_at?: string | null;
          id?: string;
          last_message_at?: string;
          listing_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dealership_id?: string | null;
          dealership_last_read_at?: string | null;
          id?: string;
          last_message_at?: string;
          listing_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_dealership_id_fkey';
            columns: ['dealership_id'];
            isOneToOne: false;
            referencedRelation: 'dealerships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      dealership_invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          dealership_id: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: Database['public']['Enums']['dealer_role'];
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          dealership_id: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role: Database['public']['Enums']['dealer_role'];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          dealership_id?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database['public']['Enums']['dealer_role'];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dealership_invitations_dealership_id_fkey';
            columns: ['dealership_id'];
            isOneToOne: false;
            referencedRelation: 'dealerships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dealership_invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      dealership_members: {
        Row: {
          created_at: string;
          dealership_id: string;
          role: Database['public']['Enums']['dealer_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dealership_id: string;
          role: Database['public']['Enums']['dealer_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          dealership_id?: string;
          role?: Database['public']['Enums']['dealer_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dealership_members_dealership_id_fkey';
            columns: ['dealership_id'];
            isOneToOne: false;
            referencedRelation: 'dealerships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dealership_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      dealerships: {
        Row: {
          address_line1: string;
          address_line2: string | null;
          city: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          email: string | null;
          id: string;
          location: unknown;
          logo_path: string | null;
          name: string;
          phone: string | null;
          postal_code: string;
          region: string;
          slug: string;
          timezone: string;
          updated_at: string;
          verification_status: Database['public']['Enums']['verification_status'];
          verified_at: string | null;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          address_line1: string;
          address_line2?: string | null;
          city: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          location: unknown;
          logo_path?: string | null;
          name: string;
          phone?: string | null;
          postal_code: string;
          region: string;
          slug: string;
          timezone: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          website?: string | null;
        };
        Update: {
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          location?: unknown;
          logo_path?: string | null;
          name?: string;
          phone?: string | null;
          postal_code?: string;
          region?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
          verification_status?: Database['public']['Enums']['verification_status'];
          verified_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dealerships_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_rsvps: {
        Row: {
          created_at: string;
          event_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_rsvps_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_rsvps_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          address: string | null;
          cancelled_at: string | null;
          capacity: number | null;
          city: string | null;
          cover_path: string | null;
          created_at: string;
          description: string;
          ends_at: string | null;
          going_count: number;
          host_id: string;
          id: string;
          location: unknown;
          postal_code: string;
          region: string | null;
          reminded_at: string | null;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at: string;
          venue_name: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          cancelled_at?: string | null;
          capacity?: number | null;
          city?: string | null;
          cover_path?: string | null;
          created_at?: string;
          description?: string;
          ends_at?: string | null;
          going_count?: number;
          host_id?: string;
          id?: string;
          location?: unknown;
          postal_code: string;
          region?: string | null;
          reminded_at?: string | null;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at?: string;
          venue_name: string;
        };
        Update: {
          address?: string | null;
          cancelled_at?: string | null;
          capacity?: number | null;
          city?: string | null;
          cover_path?: string | null;
          created_at?: string;
          description?: string;
          ends_at?: string | null;
          going_count?: number;
          host_id?: string;
          id?: string;
          location?: unknown;
          postal_code?: string;
          region?: string | null;
          reminded_at?: string | null;
          starts_at?: string;
          timezone?: string;
          title?: string;
          updated_at?: string;
          venue_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['host_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          created_at: string;
          followee_id: string;
          follower_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          followee_id: string;
          follower_id?: string;
        };
        Update: {
          created_at?: string;
          followee_id?: string;
          follower_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_followee_id_fkey';
            columns: ['followee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      listing_photos: {
        Row: {
          created_at: string;
          height: number | null;
          id: string;
          listing_id: string;
          position: number;
          storage_path: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          height?: number | null;
          id?: string;
          listing_id: string;
          position: number;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          height?: number | null;
          id?: string;
          listing_id?: string;
          position?: number;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'listing_photos_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      listing_private_locations: {
        Row: {
          listing_id: string;
          location: unknown;
          postal_code: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          listing_id: string;
          location: unknown;
          postal_code?: string | null;
          updated_at?: string;
        };
        Update: {
          listing_id?: string;
          location?: unknown;
          postal_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'listing_private_locations_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: true;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      listings: {
        Row: {
          city: string;
          condition: Database['public']['Enums']['listing_condition'];
          created_at: string;
          description: string | null;
          id: string;
          location: unknown;
          price_cents: number;
          published_at: string | null;
          region: string;
          seller_dealership_id: string | null;
          seller_user_id: string | null;
          sold_at: string | null;
          status: Database['public']['Enums']['listing_status'];
          stock_number: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          city: string;
          condition?: Database['public']['Enums']['listing_condition'];
          created_at?: string;
          description?: string | null;
          id?: string;
          location: unknown;
          price_cents: number;
          published_at?: string | null;
          region: string;
          seller_dealership_id?: string | null;
          seller_user_id?: string | null;
          sold_at?: string | null;
          status?: Database['public']['Enums']['listing_status'];
          stock_number?: string | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          city?: string;
          condition?: Database['public']['Enums']['listing_condition'];
          created_at?: string;
          description?: string | null;
          id?: string;
          location?: unknown;
          price_cents?: number;
          published_at?: string | null;
          region?: string;
          seller_dealership_id?: string | null;
          seller_user_id?: string | null;
          sold_at?: string | null;
          status?: Database['public']['Enums']['listing_status'];
          stock_number?: string | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'listings_seller_dealership_id_fkey';
            columns: ['seller_dealership_id'];
            isOneToOne: false;
            referencedRelation: 'dealerships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listings_seller_user_id_fkey';
            columns: ['seller_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listings_vehicle_dealership_fk';
            columns: ['vehicle_id', 'seller_dealership_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id', 'owner_dealership_id'];
          },
          {
            foreignKeyName: 'listings_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listings_vehicle_user_fk';
            columns: ['vehicle_id', 'seller_user_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id', 'owner_user_id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          sender_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          sender_id?: string | null;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          read_at: string | null;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          read_at?: string | null;
          type: Database['public']['Enums']['notification_type'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          read_at?: string | null;
          type?: Database['public']['Enums']['notification_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          post_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_likes_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'post_likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      postal_codes: {
        Row: {
          city: string | null;
          code: string;
          lat: number;
          lng: number;
          region: string | null;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          code: string;
          lat: number;
          lng: number;
          region?: string | null;
        };
        Update: {
          city?: string | null;
          code?: string;
          lat?: number;
          lng?: number;
          region?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          like_count: number;
          photos: NonNullable<Json>;
          reply_count: number;
          reply_to_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          like_count?: number;
          photos?: NonNullable<Json>;
          reply_count?: number;
          reply_to_id?: string | null;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          like_count?: number;
          photos?: NonNullable<Json>;
          reply_count?: number;
          reply_to_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_reply_to_id_fkey';
            columns: ['reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_private: {
        Row: {
          location: unknown;
          postal_code: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          location?: unknown;
          postal_code?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          location?: unknown;
          postal_code?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_private_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          city: string | null;
          created_at: string;
          display_name: string;
          id: string;
          region: string | null;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          region?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          region?: string | null;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      reel_likes: {
        Row: {
          created_at: string;
          reel_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          reel_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          reel_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reel_likes_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reel_likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reels: {
        Row: {
          author_id: string;
          caption: string;
          created_at: string;
          duration_seconds: number;
          height: number;
          id: string;
          like_count: number;
          poster_path: string;
          video_path: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          caption?: string;
          created_at?: string;
          duration_seconds: number;
          height: number;
          id?: string;
          like_count?: number;
          poster_path: string;
          video_path: string;
          width: number;
        };
        Update: {
          author_id?: string;
          caption?: string;
          created_at?: string;
          duration_seconds?: number;
          height?: number;
          id?: string;
          like_count?: number;
          poster_path?: string;
          video_path?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'reels_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['report_status'];
          target_id: string;
          target_snapshot: NonNullable<Json>;
          target_type: Database['public']['Enums']['report_target'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_id: string;
          target_snapshot?: NonNullable<Json>;
          target_type: Database['public']['Enums']['report_target'];
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['report_status'];
          target_id?: string;
          target_snapshot?: NonNullable<Json>;
          target_type?: Database['public']['Enums']['report_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_listings: {
        Row: {
          created_at: string;
          listing_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          listing_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          listing_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_listings_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_listings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      test_drive_requests: {
        Row: {
          confirmed_end: string | null;
          confirmed_time: string | null;
          created_at: string;
          dealer_note: string | null;
          dealership_id: string;
          duration_minutes: number;
          id: string;
          listing_id: string;
          proposed_times: string[];
          requester_id: string;
          requester_note: string | null;
          status: Database['public']['Enums']['test_drive_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          confirmed_end?: string | null;
          confirmed_time?: string | null;
          created_at?: string;
          dealer_note?: string | null;
          dealership_id: string;
          duration_minutes?: number;
          id?: string;
          listing_id: string;
          proposed_times: string[];
          requester_id: string;
          requester_note?: string | null;
          status?: Database['public']['Enums']['test_drive_status'];
          updated_at?: string;
        };
        Update: {
          confirmed_end?: string | null;
          confirmed_time?: string | null;
          created_at?: string;
          dealer_note?: string | null;
          dealership_id?: string;
          duration_minutes?: number;
          id?: string;
          listing_id?: string;
          proposed_times?: string[];
          requester_id?: string;
          requester_note?: string | null;
          status?: Database['public']['Enums']['test_drive_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'test_drive_requests_dealership_id_fkey';
            columns: ['dealership_id'];
            isOneToOne: false;
            referencedRelation: 'dealerships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'test_drive_requests_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'test_drive_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_makes: {
        Row: {
          id: number;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          name: string;
          slug: string;
        };
        Update: {
          id?: never;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      vehicle_models: {
        Row: {
          id: number;
          make_id: number;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          make_id: number;
          name: string;
          slug: string;
        };
        Update: {
          id?: never;
          make_id?: number;
          name?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_models_make_id_fkey';
            columns: ['make_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_makes';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicles: {
        Row: {
          body_style: Database['public']['Enums']['body_style'] | null;
          created_at: string;
          drivetrain: Database['public']['Enums']['drivetrain'] | null;
          exterior_color: string | null;
          fuel_type: Database['public']['Enums']['fuel_type'] | null;
          id: string;
          interior_color: string | null;
          make_id: number;
          mileage: number;
          model_id: number;
          owner_dealership_id: string | null;
          owner_user_id: string | null;
          transmission: Database['public']['Enums']['transmission'] | null;
          trim_level: string | null;
          updated_at: string;
          vin: string | null;
          year: number;
        };
        ComputedFields: never;
        Insert: {
          body_style?: Database['public']['Enums']['body_style'] | null;
          created_at?: string;
          drivetrain?: Database['public']['Enums']['drivetrain'] | null;
          exterior_color?: string | null;
          fuel_type?: Database['public']['Enums']['fuel_type'] | null;
          id?: string;
          interior_color?: string | null;
          make_id: number;
          mileage: number;
          model_id: number;
          owner_dealership_id?: string | null;
          owner_user_id?: string | null;
          transmission?: Database['public']['Enums']['transmission'] | null;
          trim_level?: string | null;
          updated_at?: string;
          vin?: string | null;
          year: number;
        };
        Update: {
          body_style?: Database['public']['Enums']['body_style'] | null;
          created_at?: string;
          drivetrain?: Database['public']['Enums']['drivetrain'] | null;
          exterior_color?: string | null;
          fuel_type?: Database['public']['Enums']['fuel_type'] | null;
          id?: string;
          interior_color?: string | null;
          make_id?: number;
          mileage?: number;
          model_id?: number;
          owner_dealership_id?: string | null;
          owner_user_id?: string | null;
          transmission?: Database['public']['Enums']['transmission'] | null;
          trim_level?: string | null;
          updated_at?: string;
          vin?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_model_fk';
            columns: ['make_id', 'model_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_models';
            referencedColumns: ['make_id', 'id'];
          },
          {
            foreignKeyName: 'vehicles_owner_dealership_id_fkey';
            columns: ['owner_dealership_id'];
            isOneToOne: false;
            referencedRelation: 'dealerships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_owner_user_id_fkey';
            columns: ['owner_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_dealership_invitation: { Args: { p_token: string }; Returns: string };
      admin_remove_listing: { Args: { p_listing_id: string }; Returns: undefined };
      apply_for_dealership: {
        Args: {
          p_address_line1: string;
          p_address_line2?: string;
          p_city: string;
          p_description?: string;
          p_email?: string;
          p_lat: number;
          p_lng: number;
          p_name: string;
          p_phone?: string;
          p_postal_code: string;
          p_region: string;
          p_timezone: string;
          p_website?: string;
        };
        Returns: string;
      };
      cancel_test_drive: { Args: { p_note?: string; p_request_id: string }; Returns: undefined };
      complete_test_drive: { Args: { p_request_id: string }; Returns: undefined };
      create_dealership_invitation: {
        Args: {
          p_dealership_id: string;
          p_email: string;
          p_role?: Database['public']['Enums']['dealer_role'];
        };
        Returns: string;
      };
      following_feed: {
        Args: { p_before?: string; p_before_id?: string; p_limit?: number };
        Returns: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          like_count: number;
          photos: NonNullable<Json>;
          reply_count: number;
          reply_to_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'posts';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      listing_insights: {
        Args: { p_listing_ids: string[] };
        Returns: {
          comparable_count: number;
          listing_id: string;
          market_price_cents: number;
          photo_count: number;
        }[];
      };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
      request_test_drive: {
        Args: { p_listing_id: string; p_note?: string; p_proposed_times: string[] };
        Returns: string;
      };
      reserve_upload: {
        Args: { p_bucket: string; p_content_type: string; p_target_id: string };
        Returns: string;
      };
      respond_test_drive: {
        Args: { p_confirm: boolean; p_note?: string; p_request_id: string; p_time?: string };
        Returns: undefined;
      };
      search_listings: {
        Args: {
          p_body_styles?: Database['public']['Enums']['body_style'][];
          p_condition?: Database['public']['Enums']['listing_condition'];
          p_drivetrains?: Database['public']['Enums']['drivetrain'][];
          p_fuel_types?: Database['public']['Enums']['fuel_type'][];
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_make_id?: number;
          p_mileage_max?: number;
          p_model_id?: number;
          p_offset?: number;
          p_price_max_cents?: number;
          p_price_min_cents?: number;
          p_radius_miles?: number;
          p_seller_type?: string;
          p_sort?: string;
          p_transmissions?: Database['public']['Enums']['transmission'][];
          p_year_max?: number;
          p_year_min?: number;
        };
        Returns: {
          body_style: Database['public']['Enums']['body_style'];
          city: string;
          condition: Database['public']['Enums']['listing_condition'];
          distance_m: number;
          drivetrain: Database['public']['Enums']['drivetrain'];
          fuel_type: Database['public']['Enums']['fuel_type'];
          listing_id: string;
          make_name: string;
          mileage: number;
          model_name: string;
          photo_path: string;
          price_cents: number;
          published_at: string;
          region: string;
          seller_name: string;
          seller_type: string;
          total_count: number;
          transmission: Database['public']['Enums']['transmission'];
          trim_level: string;
          year: number;
        }[];
      };
      set_dealership_verification: {
        Args: {
          p_dealership_id: string;
          p_status: Database['public']['Enums']['verification_status'];
        };
        Returns: undefined;
      };
      start_conversation: { Args: { p_body: string; p_listing_id: string }; Returns: string };
      upcoming_events: {
        Args: { p_lat?: number; p_limit?: number; p_lng?: number; p_radius_miles?: number };
        Returns: {
          address: string | null;
          cancelled_at: string | null;
          capacity: number | null;
          city: string | null;
          cover_path: string | null;
          created_at: string;
          description: string;
          ends_at: string | null;
          going_count: number;
          host_id: string;
          id: string;
          location: unknown;
          postal_code: string;
          region: string | null;
          reminded_at: string | null;
          starts_at: string;
          timezone: string;
          title: string;
          updated_at: string;
          venue_name: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'events';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      app_role: 'user' | 'admin';
      body_style:
        | 'sedan'
        | 'coupe'
        | 'hatchback'
        | 'wagon'
        | 'convertible'
        | 'suv'
        | 'crossover'
        | 'pickup'
        | 'minivan'
        | 'van'
        | 'other';
      dealer_role: 'staff' | 'admin' | 'owner';
      drivetrain: 'fwd' | 'rwd' | 'awd' | '4wd';
      fuel_type:
        'gasoline' | 'diesel' | 'hybrid' | 'plug_in_hybrid' | 'electric' | 'flex' | 'other';
      listing_condition: 'new' | 'used' | 'certified';
      listing_status: 'draft' | 'active' | 'pending' | 'sold' | 'removed';
      notification_type:
        | 'new_message'
        | 'test_drive_requested'
        | 'test_drive_confirmed'
        | 'test_drive_declined'
        | 'test_drive_cancelled'
        | 'dealership_verified'
        | 'dealership_rejected'
        | 'dealership_invite'
        | 'new_follower'
        | 'post_like'
        | 'post_reply'
        | 'mention'
        | 'reel_like'
        | 'reel_comment'
        | 'event_rsvp'
        | 'event_reminder'
        | 'event_cancelled';
      report_reason: 'scam' | 'spam' | 'offensive' | 'misleading' | 'stolen' | 'other';
      report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
      report_target: 'listing' | 'user' | 'message' | 'dealership' | 'post' | 'reel' | 'event';
      test_drive_status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
      transmission: 'automatic' | 'manual' | 'cvt' | 'dct';
      verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['user', 'admin'],
      body_style: [
        'sedan',
        'coupe',
        'hatchback',
        'wagon',
        'convertible',
        'suv',
        'crossover',
        'pickup',
        'minivan',
        'van',
        'other',
      ],
      dealer_role: ['staff', 'admin', 'owner'],
      drivetrain: ['fwd', 'rwd', 'awd', '4wd'],
      fuel_type: ['gasoline', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric', 'flex', 'other'],
      listing_condition: ['new', 'used', 'certified'],
      listing_status: ['draft', 'active', 'pending', 'sold', 'removed'],
      notification_type: [
        'new_message',
        'test_drive_requested',
        'test_drive_confirmed',
        'test_drive_declined',
        'test_drive_cancelled',
        'dealership_verified',
        'dealership_rejected',
        'dealership_invite',
        'new_follower',
        'post_like',
        'post_reply',
        'mention',
        'reel_like',
        'reel_comment',
        'event_rsvp',
        'event_reminder',
        'event_cancelled',
      ],
      report_reason: ['scam', 'spam', 'offensive', 'misleading', 'stolen', 'other'],
      report_status: ['open', 'reviewing', 'resolved', 'dismissed'],
      report_target: ['listing', 'user', 'message', 'dealership', 'post', 'reel', 'event'],
      test_drive_status: ['requested', 'confirmed', 'declined', 'cancelled', 'completed'],
      transmission: ['automatic', 'manual', 'cvt', 'dct'],
      verification_status: ['pending', 'verified', 'rejected', 'suspended'],
    },
  },
} as const;
