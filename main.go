package main

import (
	"context"
	"log"
	"time"

	"github.com/pkg/errors"

	"cloud.google.com/go/compute/metadata"
	compute "google.golang.org/api/compute/v1"

	"golang.org/x/oauth2/google"
)

func instanceInfo() (projectID, zone, name string, err error) {
	projectID, err = metadata.ProjectID()
	if err != nil {
		return
	}
	zone, err = metadata.Zone()
	if err != nil {
		return
	}
	name, err = metadata.InstanceName()
	if err != nil {
		return
	}
	return
}

func instancesService(ctx context.Context) (*compute.InstancesService, error) {
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/compute")
	if err != nil {
		return nil, err
	}
	computeService, err := compute.New(client)
	if err != nil {
		return nil, err
	}
	return compute.NewInstancesService(computeService), nil
}

func deleteInstance(ctx context.Context) error {
	log.Printf("deleting instance...")
	s, err := instancesService(ctx)
	if err != nil {
		return err
	}
	projectID, zone, name, err := instanceInfo()
	if err != nil {
		return err
	}
	op, err := s.Delete(projectID, zone, name).Do()
	if err != nil {
		return err
	}
	log.Printf("op %+v", op)
	return nil
}

func getMetadata(ctx context.Context) (map[string]string, error) {
	s, err := instancesService(ctx)
	if err != nil {
		return nil, err
	}
	projectID, zone, name, err := instanceInfo()
	if err != nil {
		return nil, err
	}
	instance, err := s.Get(projectID, zone, name).Do()
	if err != nil {
		return nil, err
	}
	m := make(map[string]string)
	if instance.Metadata == nil {
		return m, nil
	}
	for _, meta := range instance.Metadata.Items {
		if meta.Value == nil {
			m[meta.Key] = ""
		} else {
			m[meta.Key] = *meta.Value
		}
	}
	return m, nil
}

func checkHeartbeat(ctx context.Context) error {
	m, err := getMetadata(ctx)
	if err != nil {
		return err
	}
	timeStr, ok := m["heartbeat"]
	if !ok {
		return errors.Errorf("no heartbeat found in %v", m)
	}
	t, err := time.Parse(time.RFC3339Nano, timeStr)
	if err != nil {
		return err
	}
	log.Printf("last heartbeat time %s", t)
	if time.Now().After(t) {
		if err := deleteInstance(ctx); err != nil {
			return err
		}
	}
	return nil
}

func main() {
	ctx := context.Background()
	log.Println("Running gce-launcher...")
	ticker := time.NewTicker(10 * time.Second)
	for {
		if err := checkHeartbeat(ctx); err != nil {
			log.Printf("error checking heartbeat: %s", err)
		}
		<-ticker.C
	}
}
